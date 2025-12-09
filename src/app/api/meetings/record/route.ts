import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { livekitConfig } from '@/lib/livekit';
import { EgressClient, AccessToken } from 'livekit-server-sdk';
import path from 'path';
import fs from 'fs';

// ✅ FIX: Use correct URL for local LiveKit server
const egressUrl = process.env.LIVEKIT_URL || 'http://localhost:7880';

console.log('Egress Client Configuration:');
console.log('- Egress URL:', egressUrl);
console.log('- API Key:', livekitConfig.apiKey);
console.log('- API Secret:', livekitConfig.apiSecret ? '***' + livekitConfig.apiSecret.slice(-4) : 'MISSING');

const egressClient = new EgressClient(
  egressUrl,
  livekitConfig.apiKey,
  livekitConfig.apiSecret
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetingId, participantId, action } = body;
    
    console.log("=== Recording Request ===");
    console.log("Body:", body);
    console.log("Meeting ID:", meetingId);
    console.log("Participant ID:", participantId);
    console.log("Action:", action);

    if (!meetingId || !participantId || !action) {
      console.error("Missing required fields:", { meetingId, participantId, action });
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
      
      // Ensure local recordings directory exists
      const recordingsDir = path.join(process.cwd(), 'recordings');
      if (!fs.existsSync(recordingsDir)) {
        console.log('Creating recordings directory:', recordingsDir);
        fs.mkdirSync(recordingsDir, { recursive: true });
      }

      // Docker container saves to /out, which is mapped to ./recordings
      const dockerFilePath = `/out/${fileName}`;

      // Create a special token for the recording bot
      const botIdentity = `recorder-bot-${Date.now()}`;
      const recordingToken = new AccessToken(
        livekitConfig.apiKey,
        livekitConfig.apiSecret,
        {
          identity: botIdentity,
          name: 'Recording Bot',
        }
      );

      recordingToken.addGrant({
        room: participant.meeting.roomName,
        roomJoin: true,
        canPublish: false,
        canSubscribe: true,
        canPublishData: false,
        hidden: true, // This hides the recording bot from participant list
      });

      const token = await recordingToken.toJwt();

      // ✅ Build the URL to your recording page
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const recordingUrl = `${appUrl}/meeting/${participant.meeting.roomName}/record?token=${encodeURIComponent(token)}&host=${encodeURIComponent(participant.meeting.hostIdentity || participant.identity)}`;

      console.log('=== Starting Recording ===');
      console.log('Recording URL:', recordingUrl);
      console.log('Docker file path:', dockerFilePath);
      console.log('Room name:', participant.meeting.roomName);
      console.log('Bot identity:', botIdentity);
      console.log('App URL:', appUrl);

      // Test if the URL is accessible
      try {
        const testResponse = await fetch(recordingUrl, { method: 'HEAD' });
        console.log('URL accessibility test:', testResponse.ok ? 'SUCCESS' : 'FAILED');
        console.log('URL status:', testResponse.status);
      } catch (e) {
        console.error('URL accessibility test failed:', e);
      }

      // ✅ Use Web Egress with optimized settings for meeting recording
      const egressInfo = await egressClient.startWebEgress(
        recordingUrl,
        {
          file: {
            filepath: dockerFilePath,
          },
          width: 1920,
          height: 1080,
          audioOnly: false,
          videoOnly: false,
          awaitStartSignal: false,
        }
      );

      console.log('Web Egress started:', egressInfo.egressId);

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
          filename: fileName,
          type: 'web-egress',
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

      console.log('Stopping recording:', activeRecording.egressId);

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

      // Wait a moment for file to be written
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if file exists
      const recordingsDir = path.join(process.cwd(), 'recordings');
      const localFilePath = path.join(recordingsDir, activeRecording.filename);
      const fileExists = fs.existsSync(localFilePath);
      
      console.log('Recording stopped');
      console.log('Expected file path:', localFilePath);
      console.log('File exists:', fileExists);
      if (fileExists) {
        const stats = fs.statSync(localFilePath);
        console.log('File size:', stats.size, 'bytes');
      }

      return NextResponse.json({
        message: 'Recording stopped',
        recording: {
          id: activeRecording.id,
          egressId: activeRecording.egressId,
          status: 'completed',
          filename: activeRecording.filename,
          fileExists,
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
      { error: 'Failed to control recording', details: error instanceof Error ? error.message : 'Unknown error' },
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