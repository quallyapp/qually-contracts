const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.subscribers = new Map();
    this.emailEnabled = !!config.notifications.smtpHost;
  }

  /**
   * Register a user for notifications
   */
  subscribe(userId, channels = { email: true, webhook: false }) {
    this.subscribers.set(userId, {
      channels,
      createdAt: new Date(),
    });
    logger.info(`User ${userId} subscribed to notifications`);
  }

  /**
   * Unsubscribe a user
   */
  unsubscribe(userId) {
    this.subscribers.delete(userId);
    logger.info(`User ${userId} unsubscribed from notifications`);
  }

  /**
   * Send notification for bounty events
   */
  async notifyBountyEvent(eventType, data) {
    const notifications = {
      'bounty.created': {
        title: 'New Bounty Created',
        message: `A new ${data.bountyType} bounty has been posted with ${data.prizePool} SUI prize pool.`,
        recipients: data.subscribers || [],
      },
      'bounty.submission': {
        title: 'New Submission Received',
        message: `A new submission has been received for bounty: ${data.bountyId}`,
        recipients: [data.poster],
      },
      'bounty.review_started': {
        title: 'Review Phase Started',
        message: `Bounty ${data.bountyId} is now open for judging.`,
        recipients: data.judges || [],
      },
      'bounty.finalized': {
        title: 'Bounty Finalized',
        message: `Bounty ${data.bountyId} has been finalized. Winner: ${data.winner}`,
        recipients: [data.winner, data.poster],
      },
      'bounty.payout': {
        title: 'Payout Received',
        message: `You received ${data.amount} SUI for bounty ${data.bountyId}`,
        recipients: [data.recipient],
      },
      'judge.approved': {
        title: 'Judge Application Approved',
        message: `Your application to judge bounty ${data.bountyId} has been approved.`,
        recipients: [data.judge],
      },
      'judge.stake.slashed': {
        title: 'Stake Slashed',
        message: `Your stake has been slashed for bounty ${data.bountyId}. Reason: ${data.reason}`,
        recipients: [data.judge],
      },
      'milestone.submitted': {
        title: 'Milestone Submitted',
        message: `Milestone ${data.milestoneIndex} has been submitted for review.`,
        recipients: [data.poster],
      },
      'milestone.approved': {
        title: 'Milestone Approved',
        message: `Milestone ${data.milestoneIndex} has been approved. Payout: ${data.amount} SUI`,
        recipients: [data.hunter],
      },
      'milestone.overdue': {
        title: 'Milestone Overdue',
        message: `Milestone ${data.milestoneIndex} is now overdue.`,
        recipients: [data.poster, data.hunter],
      },
      'dispute.opened': {
        title: 'Dispute Opened',
        message: `A dispute has been opened for bounty ${data.bountyId}`,
        recipients: [data.poster, data.hunter],
      },
      'dispute.resolved': {
        title: 'Dispute Resolved',
        message: `Dispute for bounty ${data.bountyId} has been resolved. Outcome: ${data.outcome}`,
        recipients: [data.poster, data.hunter],
      },
      'deadline.approaching': {
        title: 'Deadline Approaching',
        message: `Bounty ${data.bountyId} deadline is in ${data.hoursLeft} hours.`,
        recipients: data.recipients || [],
      },
    };

    const notification = notifications[eventType];
    if (!notification) {
      logger.warn(`Unknown event type: ${eventType}`);
      return;
    }

    logger.info(`Sending notification: ${notification.title}`, {
      eventType,
      recipients: notification.recipients,
    });

    // Send to all recipients
    for (const recipient of notification.recipients) {
      await this.sendNotification(recipient, notification);
    }
  }

  /**
   * Send notification to a specific user
   */
  async sendNotification(userId, notification) {
    const subscriber = this.subscribers.get(userId);
    if (!subscriber) {
      logger.debug(`User ${userId} not subscribed, skipping notification`);
      return;
    }

    // Send email if enabled
    if (subscriber.channels.email && this.emailEnabled) {
      await this.sendEmail(userId, notification);
    }

    // TODO: Add other channels (SMS, push, etc.)
  }

  /**
   * Send email notification
   */
  async sendEmail(userId, notification) {
    // Email sending logic would go here
    // For now, just log it
    logger.info(`Email notification to ${userId}: ${notification.title}`);
  }

  /**
   * Get subscriber count
   */
  getSubscriberCount() {
    return this.subscribers.size;
  }
}

const config = require('../config');
module.exports = new NotificationService();
