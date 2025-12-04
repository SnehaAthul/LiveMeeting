'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface JoinMeetingDialogProps {
  trigger: React.ReactNode;
  role: 'participant' | 'viewer';
}

export default function JoinMeetingDialog({ trigger, role }: JoinMeetingDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [meetingId, setMeetingId] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [email, setEmail] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!meetingId.trim() || !participantName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/meetings/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId: meetingId.trim(),
          participantName: participantName.trim(),
          email: email.trim() || undefined,
          role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join meeting');
      }

      const data = await response.json();
      
      // Store meeting data in localStorage for the live room page
      localStorage.setItem('meetingData', JSON.stringify(data));
      
      toast.success(`Joined meeting as ${role}!`);
      setOpen(false);
      
      // Navigate to the live room
      router.push(`/room/${data.meeting.roomName}`);
    } catch (error: any) {
      console.error('Error joining meeting:', error);
      toast.error(error.message || 'Failed to join meeting. Please check the meeting ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  const roleText = role === 'participant' ? 'Participant' : 'Viewer';
  const roleDescription = role === 'participant' 
    ? 'Join with audio, video, and screen sharing capabilities' 
    : 'Watch the meeting without participating';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join as {roleText}</DialogTitle>
          <DialogDescription>
            {roleDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="meetingId">Meeting ID *</Label>
              <Input
                id="meetingId"
                placeholder="Enter meeting ID"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                You can find the meeting ID from the meeting invitation or active meetings list
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="participantName">Your Name *</Label>
              <Input
                id="participantName"
                placeholder="Enter your name"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Joining...' : `Join as ${roleText}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}