import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { RoomServiceClient } from 'livekit-server-sdk';
import { livekitConfig } from '@/lib/livekit';

const roomService = new RoomServiceClient(
  livekitConfig.wsUrl.replace('wss://', 'https://').replace('ws://', 'http://'),
  livekitConfig.apiKey,
  livekitConfig.apiSecret
);

export async function POST(request: NextRequest) {
  try {
    const { participantId } = await request.json();

    if (!participantId) {
      return NextResponse.json(
        { error: 'Participant ID is required' },
        { status: 400 }
      );
    }

    // Get participant info
    const participant = await db.participant.findUnique({
      where: { id: participantId },
      include: { meeting: true }
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    // Remove participant from LiveKit room (this will trigger ParticipantDisconnected event for others)
    try {
      await roomService.removeParticipant(
        participant.meeting.roomName,
        participant.identity
      );
      console.log(`Removed participant ${participant.identity} from LiveKit room ${participant.meeting.roomName}`);
    } catch (liveKitError) {
      console.error('Error removing participant from LiveKit:', liveKitError);
      // Continue even if LiveKit removal fails
    }

    // Update participant left time in database
    await db.participant.update({
      where: { id: participantId },
      data: { leftAt: new Date() },
    });

    return NextResponse.json({ 
      message: 'Left meeting successfully',
      participantId,
      meetingId: participant.meetingId
    });
  } catch (error) {
    console.error('Error leaving meeting:', error);
    return NextResponse.json(
      { error: 'Failed to leave meeting' },
      { status: 500 }
    );
  }
}