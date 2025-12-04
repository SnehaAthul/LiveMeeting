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
    const { meetingId, participantId } = await request.json();

    if (!meetingId || !participantId) {
      return NextResponse.json(
        { error: 'Meeting ID and participant ID are required' },
        { status: 400 }
      );
    }

    // Verify the participant is the host
    const participant = await db.participant.findUnique({
      where: { id: participantId },
      include: { meeting: true },
    });

    if (!participant || participant.role !== 'host') {
      return NextResponse.json(
        { error: 'Only the host can end the meeting' },
        { status: 403 }
      );
    }

    // Get the meeting
    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Delete the LiveKit room (this disconnects all participants)
    try {
      await roomService.deleteRoom(meeting.roomName);
      console.log(`LiveKit room ${meeting.roomName} deleted`);
    } catch (liveKitError) {
      console.error('Error deleting LiveKit room:', liveKitError);
      // Continue even if LiveKit room deletion fails
    }

    // Stop any active recordings
    const activeRecordings = await db.recording.findMany({
      where: {
        meetingId,
        status: { in: ['starting', 'active'] }
      }
    });

    if (activeRecordings.length > 0) {
      await db.recording.updateMany({
        where: {
          meetingId,
          status: { in: ['starting', 'active'] }
        },
        data: {
          status: 'completed',
          endTime: new Date(),
        }
      });
    }

    // Update all participants who haven't left yet
    await db.participant.updateMany({
      where: {
        meetingId,
        leftAt: null,
      },
      data: {
        leftAt: new Date(),
      },
    });

    // Update meeting status
    await db.meeting.update({
      where: { id: meetingId },
      data: {
        isActive: false,
        isRecording: false,
        endTime: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Meeting ended successfully',
      meetingId,
    });

  } catch (error) {
    console.error('Error ending meeting:', error);
    return NextResponse.json(
      { error: 'Failed to end meeting' },
      { status: 500 }
    );
  }
}