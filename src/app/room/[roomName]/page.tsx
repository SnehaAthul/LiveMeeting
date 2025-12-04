'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LiveRoom } from '@/components/LiveRoom';
import { ArrowLeft, Phone, Monitor, Users, Eye } from 'lucide-react';

interface MeetingData {
  meeting: {
    id: string;
    title: string;
    roomName: string;
    hostName: string;
  };
  participant: {
    id: string;
    identity: string;
    role: string;
  };
  token: {
    token: string;
    url: string;
  };
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Get meeting data from localStorage
    const storedData = localStorage.getItem('meetingData');
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        setMeetingData(data);
      } catch (err) {
        setError('Invalid meeting data');
      }
    } else {
      setError('No meeting data found. Please join or create a meeting first.');
    }
    setLoading(false);
  }, []);

  const handleEndMeeting = async () => {
    if (!meetingData) return;

    setIsEnding(true);
    try {
      const response = await fetch('/api/meetings/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingId: meetingData.meeting.id,
          participantId: meetingData.participant.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to end meeting');
      }

      // Clear localStorage and redirect
      localStorage.removeItem('meetingData');
      router.push('/');
    } catch (error) {
      console.error('Error ending meeting:', error);
      alert('Failed to end meeting. Please try again.');
      setIsEnding(false);
    }
  };

  const handleLeaveMeeting = async () => {
    if (!meetingData?.participant?.id) {
      // If no participant data, just redirect
      localStorage.removeItem('meetingData');
      router.push('/');
      return;
    }

    setIsLeaving(true);
    try {
      const response = await fetch('/api/meetings/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId: meetingData.participant.id,
        }),
      });

      if (!response.ok) {
        console.error('Failed to leave meeting properly');
      }
    } catch (error) {
      console.error('Error leaving meeting:', error);
    } finally {
      // Always clear localStorage and redirect
      localStorage.removeItem('meetingData');
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading meeting room...</p>
        </div>
      </div>
    );
  }

  if (error || !meetingData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error || 'Failed to load meeting'}</p>
            <Button onClick={() => router.push('/')} className="w-full">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { meeting, participant, token } = meetingData;
  const isHost = participant.role === 'host';
  const isViewer = participant.role === 'viewer';

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
                className="text-slate-300 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Leave Meeting
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-white font-semibold">{meeting.title}</h1>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span>Host: {meeting.hostName}</span>
                  <span>•</span>
                  <Badge variant={isHost ? "default" : isViewer ? "secondary" : "outline"}>
                    {isHost ? 'Host' : isViewer ? 'Viewer' : 'Participant'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isHost && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleEndMeeting}
                  disabled={isEnding}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  {isEnding ? 'Ending...' : 'End Meeting'}
                </Button>
              )}
              {!isHost && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLeaveMeeting}
                  disabled={isLeaving}
                  className="text-slate-300 border-slate-600 hover:bg-slate-700"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  {isLeaving ? 'Leaving...' : 'Leave'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* {console.log("TOKEN SENT TO LiveRoom =", token.token)}
        {console.log("TYPE =", typeof token.token)}
        {console.log("SERVER URL =", token.url)}
        {console.log("PARTICIPANT ROLE =", participant.role)}
        {console.log("PARTICIPANT IDENTITY =", participant.identity)} */}

        <LiveRoom
          token={token.token}
          serverUrl={token.url}
          roomName={meeting.roomName}
          participantRole={participant.role}
          participantIdentity={participant.identity}
          meetingId={meeting.id}
          participantId={participant.id}
          onLeave={handleLeaveMeeting}
        />
      </div>
    </div>
  );
}