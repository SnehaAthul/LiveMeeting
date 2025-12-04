import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { livekitConfig } from '@/lib/livekit';
import { EgressClient } from 'livekit-server-sdk';
import path from 'path';

// const egressClient = new EgressClient(
//   livekitConfig.wsUrl.replace('wss://', 'https://'),
//   livekitConfig.apiKey,
//   livekitConfig.apiSecret
// );
const egressUrl = livekitConfig.wsUrl
  .replace('wss://', 'https://')
  .replace('ws://', 'http://');

const egressClient = new EgressClient(
  egressUrl,
  livekitConfig.apiKey,
  livekitConfig.apiSecret
);

export async function POST(request: NextRequest) {
  try {
    const { meetingId, participantId, action } = await request.json();
    console.log("Meeting_____",meetingId);

    if (!meetingId || !participantId || !action) {
      return NextResponse.json(
        { error: 'Meeting ID, participant ID, and action are required' },
        { status: 400 }
      );
    }

    // Get participant to verify they are the host
    const participant = await db.participant.findUnique({
      where: { id: participantId },
      include: { meeting: true },
    });

    if (!participant || participant.role !== 'host') {
      return NextResponse.json(
        { error: 'Only the host can control recording' },
        { status: 403 }
      );
    }

    if (action === 'start') {
      // Check if already recording
      const existingRecording = await db.recording.findFirst({
        where: { 
          meetingId,
          status: { in: ['starting', 'active'] }
        },
      });

      if (existingRecording) {
        return NextResponse.json(
          { error: 'Recording is already in progress' },
          { status: 400 }
        );
      }
      const fileName = `${participant.meeting.roomName}-${Date.now()}.mp4`;
      // const filePath = path.join(
      //   process.cwd(),
      //   'recordings',
      //   fileName
      // );

      // Start recording with LiveKit Egress
      const egressInfo = await egressClient.startRoomCompositeEgress(
        participant.meeting.roomName,
        {
          file: {
            // filepath: filePath,
            filepath: `/out/${fileName}`,
            // filepath: `recordings/${participant.meeting.roomName}-${Date.now()}.mp4`,
          },
          layout: 'grid',
        }
      );

      // Save recording to database
      const recording = await db.recording.create({
        data: {
          meetingId,
          egressId: egressInfo.egressId,
          filename: fileName,
          fileUrl: `/recordings/${fileName}`,
          status: 'active',
          startTime: new Date(),
        },
      });

      // Update meeting recording status
      await db.meeting.update({
        where: { id: meetingId },
        data: { isRecording: true },
      });

      return NextResponse.json({
        message: 'Recording started',
        recording: {
          id: recording.id,
          egressId: recording.egressId,
          status: recording.status,
        },
      });

    } else if (action === 'stop') {
      // Find active recording
      const activeRecording = await db.recording.findFirst({
        where: { 
          meetingId,
          status: { in: ['starting', 'active'] }
        },
      });

      if (!activeRecording) {
        return NextResponse.json(
          { error: 'No active recording found' },
          { status: 404 }
        );
      }

      // Stop recording with LiveKit Egress
      await egressClient.stopEgress(activeRecording.egressId);

      // Update recording status
      await db.recording.update({
        where: { id: activeRecording.id },
        data: {
          status: 'completed',
          endTime: new Date(),
        },
      });

      // Update meeting recording status
      await db.meeting.update({
        where: { id: meetingId },
        data: { isRecording: false },
      });

      return NextResponse.json({
        message: 'Recording stopped',
        recording: {
          id: activeRecording.id,
          egressId: activeRecording.egressId,
          status: 'completed',
        },
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "start" or "stop"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error controlling recording:', error);
    return NextResponse.json(
      { error: 'Failed to control recording' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meetingId');

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    const recordings = await db.recording.findMany({
      where: { meetingId },
      orderBy: { startTime: 'desc' },
    });

    return NextResponse.json({ recordings });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recordings' },
      { status: 500 }
    );
  }
}