import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useContract } from '../../hooks/useContract';
import { Loader2, Play, CheckCircle, XCircle, DollarSign, Clock, RefreshCw, Ban, Lock } from 'lucide-react';
import type { Bounty } from '../../types';

interface PosterActionsProps {
  bounty: Bounty;
}

export function PosterActions({ bounty }: PosterActionsProps) {
  const { pending, startReview, finalizeFixed, vetoResult, boostPrizePool, autoExtend, refundEmpty, closeBounty, setGated } = useContract();
  const [winnerAddress, setWinnerAddress] = useState('');
  const [boostAmount, setBoostAmount] = useState('');
  const [extensionDays, setExtensionDays] = useState('1'); // days
  const [isGated, setIsGated] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const now = Date.now();
  const finalizedAt = bounty.createdAt.getTime(); // Placeholder - in real app would come from bounty
  const within48h = now - finalizedAt < 48 * 60 * 60 * 1000;

  const handleAction = async (action: () => Promise<{ success: boolean; error?: string }>, successMsg: string) => {
    setMessage(null);
    const result = await action();
    if (result.success) {
      setMessage({ type: 'success', text: successMsg });
    } else {
      setMessage({ type: 'error', text: result.error || 'Transaction failed' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Lock className="size-4" />
          Poster Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {message && (
          <div className={`p-2 rounded text-xs ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        {/* Start Review */}
        {bounty.status === 'open' && Date.now() >= bounty.submissionDeadline.getTime() && (
          <div className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-surface-low">
            <div>
              <p className="text-sm font-medium">Start Review</p>
              <p className="text-xs text-on-surface-variant">Begin judging phase</p>
            </div>
            <Button
              size="sm"
              onClick={() => handleAction(() => startReview(bounty.id), 'Review started successfully')}
              disabled={pending}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            </Button>
          </div>
        )}

        {/* Finalize Fixed */}
        {bounty.status === 'review' && bounty.type === 'fixed' && (
          <div className="p-2 rounded border border-border bg-surface-low space-y-2">
            <p className="text-sm font-medium">Finalize Fixed Bounty</p>
            <div className="flex gap-2">
              <Input
                placeholder="Winner address"
                value={winnerAddress}
                onChange={(e) => setWinnerAddress(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => handleAction(() => finalizeFixed(bounty.id, winnerAddress), 'Bounty finalized')}
                disabled={pending || !winnerAddress}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Veto Result */}
        {within48h && (
          <div className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-surface-low">
            <div>
              <p className="text-sm font-medium">Veto Result</p>
              <p className="text-xs text-on-surface-variant">Within 48h window</p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleAction(() => vetoResult(bounty.id, finalizedAt), 'Result vetoed')}
              disabled={pending}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            </Button>
          </div>
        )}

        {/* Boost Prize Pool */}
        {bounty.status === 'open' && (
          <div className="p-2 rounded border border-border bg-surface-low space-y-2">
            <p className="text-sm font-medium flex items-center gap-1">
              <DollarSign className="size-4" />
              Boost Prize Pool
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="SUI amount"
                value={boostAmount}
                onChange={(e) => setBoostAmount(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => handleAction(() => boostPrizePool(bounty.id, Number(boostAmount) * 1_000_000_000), 'Prize pool boosted')}
                disabled={pending || !boostAmount}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <DollarSign className="size-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Auto Extend */}
        {bounty.submissionCount < 2 && (
          <div className="p-2 rounded border border-border bg-surface-low space-y-2">
            <p className="text-sm font-medium flex items-center gap-1">
              <Clock className="size-4" />
              Auto Extend Deadline
            </p>
            <div className="flex gap-2">
              <select
                value={extensionDays}
                onChange={(e) => setExtensionDays(e.target.value)}
                className="flex-1 h-9 rounded-md border border-border bg-card px-3 text-sm"
              >
                <option value="1">1 day</option>
                <option value="2">2 days</option>
                <option value="3">3 days</option>
                <option value="5">5 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
              </select>
              <Button
                size="sm"
                onClick={() => handleAction(() => autoExtend(bounty.id, Number(extensionDays) * 24 * 60 * 60 * 1000), `Extended by ${extensionDays} day(s)`)}
                disabled={pending}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Refund Empty */}
        {bounty.submissionCount === 0 && new Date() > bounty.submissionDeadline && (
          <div className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-surface-low">
            <div>
              <p className="text-sm font-medium">Refund Empty</p>
              <p className="text-xs text-on-surface-variant">No submissions past deadline</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction(() => refundEmpty(bounty.id), 'Refund processed')}
              disabled={pending}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
            </Button>
          </div>
        )}

        {/* Close Bounty */}
        {bounty.status === 'closed' && (
          <div className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-surface-low">
            <div>
              <p className="text-sm font-medium">Close Bounty</p>
              <p className="text-xs text-on-surface-variant">Already closed</p>
            </div>
            <Badge variant="secondary">Closed</Badge>
          </div>
        )}

        {/* Set Gated */}
        {bounty.status === 'open' && (
          <div className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-surface-low">
            <div>
              <p className="text-sm font-medium">Gated Submissions</p>
              <p className="text-xs text-on-surface-variant">Restrict to approved submitters</p>
            </div>
            <Switch
              checked={isGated}
              onCheckedChange={(checked) => {
                setIsGated(checked);
                handleAction(() => setGated(bounty.id, checked), `Gated ${checked ? 'enabled' : 'disabled'}`);
              }}
              disabled={pending}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}