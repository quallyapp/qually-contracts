export interface Bounty {
  id: string;
  title: string;
  type: 'fixed' | 'contest' | 'grant';
  status: 'open' | 'review' | 'closed';
  prizePool: number;
  category: string;
  skills: string[];
  submissionDeadline: Date;
  judgingDeadline: Date;
  submissionCount: number;
  posterAddress: string;
  posterReputation: number;
  description: string;
  splits: number[];
  createdAt: Date;
  submittedAddresses: string[];
}
