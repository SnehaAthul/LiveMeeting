import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateToken } from '@/lib/livekit';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { meetingId, participantName, email, role = 'participant' } = await request.json();

    if (!meetingId || !participantName) {
      return NextResponse.json(
        { error: 'Meeting ID and participant name are required' },
        { status: 400 }
      );
    }

    // Get meeting details
    const meeting = await db.meeting.findUnique({
      where: { id: meetingId, isActive: true },
      include: { host: true },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found or inactive' },
        { status: 404 }
      );
    }

    // Create or find user
    let user = null;
    if (email) {
      user = await db.user.findUnique({
        where: { email },
      });
      
      if (!user) {
        user = await db.user.create({
          data: {
            email,
            name: participantName,
            role: 'user',
          },
        });
      }
    }

    // Generate unique identity
    const identity = `${role}-${randomBytes(8).toString('hex')}`;

    // Check if participant already exists
    const existingParticipant = await db.participant.findFirst({
      where: {
        meetingId,
        userId: user?.id,
        name: participantName,
        leftAt: null,
      },
    });

    if (existingParticipant) {
      // Generate token for existing participant
      const tokenData = await generateToken({
        roomName: meeting.roomName,
        participantName,
        identity: existingParticipant.identity,
        role: role as 'host' | 'participant' | 'viewer',
      });

      return NextResponse.json({
        meeting: {
          id: meeting.id,
          title: meeting.title,
          roomName: meeting.roomName,
          hostName: meeting.host.name,
        },
        participant: {
          id: existingParticipant.id,
          identity: existingParticipant.identity,
          role: existingParticipant.role,
          name: existingParticipant.name,
        },
        // token: tokenData,
        token: {
          token: tokenData.token,  
          url: tokenData.url,
        }
      });
    }

    // Create new participant
    const participant = await db.participant.create({
      data: {
        meetingId,
        userId: user?.id,
        identity,
        name: participantName,
        role,
        permissions: role === 'viewer' ? 'viewer' : 'participant',
      },
    });

    // Generate token
    const tokenData = await generateToken({
      roomName: meeting.roomName,
      participantName,
      identity,
      role: role as 'host' | 'participant' | 'viewer',
    });

    return NextResponse.json({
      meeting: {
        id: meeting.id,
        title: meeting.title,
        roomName: meeting.roomName,
        hostName: meeting.host.name,
      },
      participant: {
        id: participant.id,
        identity: participant.identity,
        role: participant.role,
      },
      // token: tokenData,
      token: {
        token: tokenData.token,  
        url: tokenData.url,
      }
    });
  } catch (error) {
    console.error('Error joining meeting:', error);
    return NextResponse.json(
      { error: 'Failed to join meeting' },
      { status: 500 }
    );
  }
}