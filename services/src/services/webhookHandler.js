const tatumService = require('./tatum');
const notificationService = require('./notification');
const logger = require('../utils/logger');
const config = require('../config');

class WebhookHandler {
  /**
   * Process incoming Tatum webhook event
   */
  async handleTatumWebhook(req, res) {
    try {
      const event = req.body;
      const signature = req.headers['x-tatum-signature'];

      // Validate signature if secret is configured
      if (config.tatum.webhookSecret && signature) {
        if (!tatumService.validateWebhookSignature(event, signature)) {
          logger.warn('Invalid webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      logger.info('Tatum webhook received:', {
        type: event.type,
        chain: event.chain,
        address: event.address,
      });

      // Route event to appropriate handler
      const handled = await this.routeEvent(event);

      if (handled) {
        res.status(200).json({ status: 'processed' });
      } else {
        res.status(200).json({ status: 'ignored' });
      }
    } catch (error) {
      logger.error('Webhook handling error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Route event to appropriate handler based on type
   */
  async routeEvent(event) {
    const { type, contractAddress, transactionId, amount, to, from } = event;

    // SUI transaction events
    if (type === 'ADDRESS_EVENT' || type === 'SUI_EVENT') {
      // Check if this is a Qually contract event
      if (contractAddress === config.sui.packageId) {
        return await this.handleQuallyEvent(event);
      }

      // Check if this is a payment to Treasury
      if (to === config.sui.treasuryId) {
        return await this.handleTreasuryPayment(event);
      }

      // Check if this is a payout from Treasury
      if (from === config.sui.treasuryId) {
        return await this.handlePayout(event);
      }
    }

    return false;
  }

  /**
   * Handle Qually-specific contract events
   */
  async handleQuallyEvent(event) {
    const { module: moveModule, function: moveFunction, sender } = event;

    // Parse event based on Move module
    switch (moveModule) {
      case 'bounty':
        return await this.handleBountyEvent(event);
      case 'submission':
        return await this.handleSubmitEvent(event);
      case 'voting':
        return await this.handleVoteEvent(event);
      case 'judge':
        return await this.handleJudgeEvent(event);
      case 'milestone':
        return await this.handleMilestoneEvent(event);
      case 'dispute':
        return await this.handleDisputeEvent(event);
      default:
        logger.debug(`Unknown module: ${moveModule}`);
        return false;
    }
  }

  /**
   * Handle bounty-related events
   */
  async handleBountyEvent(event) {
    const { function: fn, sender } = event;

    switch (fn) {
      case 'create_bounty':
        await notificationService.notifyBountyEvent('bounty.created', {
          bountyType: this.parseBountyType(event.arguments?.bountyType),
          prizePool: this.formatMist(event.arguments?.prizePool),
          poster: sender,
          bountyId: event.arguments?.bountyId,
        });
        return true;

      case 'start_review':
        await notificationService.notifyBountyEvent('bounty.review_started', {
          bountyId: event.arguments?.bountyId,
          judges: event.arguments?.judges || [],
        });
        return true;

      case 'finalize_bounty':
        await notificationService.notifyBountyEvent('bounty.finalized', {
          bountyId: event.arguments?.bountyId,
          winner: event.arguments?.winner,
          poster: sender,
        });
        return true;

      case 'veto_result':
        await notificationService.notifyBountyEvent('bounty.vetoed', {
          bountyId: event.arguments?.bountyId,
          poster: sender,
        });
        return true;

      case 'refund_empty_bounty':
        await notificationService.notifyBountyEvent('bounty.refunded', {
          bountyId: event.arguments?.bountyId,
          poster: sender,
          amount: this.formatMist(event.arguments?.amount),
        });
        return true;

      default:
        return false;
    }
  }

  /**
   * Handle submission events
   */
  async handleSubmitEvent(event) {
    if (event.function === 'submit_work') {
      await notificationService.notifyBountyEvent('bounty.submission', {
        bountyId: event.arguments?.bountyId,
        poster: event.arguments?.poster,
        hunter: event.sender,
        submissionId: event.arguments?.submissionId,
      });
      return true;
    }
    return false;
  }

  /**
   * Handle voting events
   */
  async handleVoteEvent(event) {
    // Vote commits are private, only log
    logger.info('Vote event:', {
      function: event.function,
      judge: event.sender,
    });
    return true;
  }

  /**
   * Handle judge events
   */
  async handleJudgeEvent(event) {
    switch (event.function) {
      case 'apply_as_judge':
        logger.info('Judge application received', {
          judge: event.sender,
          bountyId: event.arguments?.bountyId,
        });
        return true;

      case 'approve_judge':
        await notificationService.notifyBountyEvent('judge.approved', {
          bountyId: event.arguments?.bountyId,
          judge: event.arguments?.judge,
        });
        return true;

      case 'release_stake':
        await notificationService.notifyBountyEvent('judge.stake.released', {
          judge: event.sender,
          amount: this.formatMist(event.arguments?.amount),
        });
        return true;

      default:
        return false;
    }
  }

  /**
   * Handle milestone events
   */
  async handleMilestoneEvent(event) {
    switch (event.function) {
      case 'submit_milestone':
        await notificationService.notifyBountyEvent('milestone.submitted', {
          milestoneIndex: event.arguments?.milestoneIndex,
          poster: event.arguments?.poster,
          hunter: event.sender,
          bountyId: event.arguments?.bountyId,
        });
        return true;

      case 'approve_milestone':
        await notificationService.notifyBountyEvent('milestone.approved', {
          milestoneIndex: event.arguments?.milestoneIndex,
          hunter: event.arguments?.hunter,
          amount: this.formatMist(event.arguments?.amount),
          bountyId: event.arguments?.bountyId,
        });
        return true;

      case 'reject_milestone':
        await notificationService.notifyBountyEvent('milestone.rejected', {
          milestoneIndex: event.arguments?.milestoneIndex,
          hunter: event.arguments?.hunter,
          bountyId: event.arguments?.bountyId,
        });
        return true;

      case 'escalate_overdue':
        await notificationService.notifyBountyEvent('milestone.overdue', {
          milestoneIndex: event.arguments?.milestoneIndex,
          poster: event.arguments?.poster,
          hunter: event.arguments?.hunter,
          bountyId: event.arguments?.bountyId,
        });
        return true;

      default:
        return false;
    }
  }

  /**
   * Handle dispute events
   */
  async handleDisputeEvent(event) {
    switch (event.function) {
      case 'open_dispute':
        await notificationService.notifyBountyEvent('dispute.opened', {
          bountyId: event.arguments?.bountyId,
          poster: event.arguments?.poster,
          hunter: event.sender,
          submissionId: event.arguments?.submissionId,
        });
        return true;

      case 'resolve_dispute':
        await notificationService.notifyBountyEvent('dispute.resolved', {
          bountyId: event.arguments?.bountyId,
          outcome: this.parseDisputeOutcome(event.arguments?.outcome),
          poster: event.arguments?.poster,
          hunter: event.arguments?.hunter,
        });
        return true;

      case 'reject_dispute':
        await notificationService.notifyBountyEvent('dispute.rejected', {
          bountyId: event.arguments?.bountyId,
          poster: event.arguments?.poster,
          hunter: event.arguments?.hunter,
        });
        return true;

      default:
        return false;
    }
  }

  /**
   * Handle Treasury payments (deposits)
   */
  async handleTreasuryPayment(event) {
    logger.info('Treasury payment received:', {
      from: event.from,
      amount: this.formatMist(event.amount),
      transactionId: event.transactionId,
    });

    await notificationService.notifyBountyEvent('treasury.deposit', {
      from: event.from,
      amount: this.formatMist(event.amount),
    });

    return true;
  }

  /**
   * Handle payouts from Treasury
   */
  async handlePayout(event) {
    await notificationService.notifyBountyEvent('bounty.payout', {
      recipient: event.to,
      amount: this.formatMist(event.amount),
      bountyId: event.arguments?.bountyId,
    });
    return true;
  }

  /**
   * Parse bounty type number to string
   */
  parseBountyType(type) {
    const types = { 0: 'Fixed', 1: 'Contest', 2: 'Grant' };
    return types[type] || 'Unknown';
  }

  /**
   * Parse dispute outcome number to string
   */
  parseDisputeOutcome(outcome) {
    const outcomes = { 1: 'Hunter Wins', 2: 'Poster Wins', 3: 'Split' };
    return outcomes[outcome] || 'Unknown';
  }

  /**
   * Format MIST to SUI (1 SUI = 1,000,000,000 MIST)
   */
  formatMist(mist) {
    if (!mist) return '0';
    return (BigInt(mist) / BigInt(1000000000)).toString();
  }
}

module.exports = new WebhookHandler();
