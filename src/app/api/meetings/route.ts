import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateToken } from '@/lib/livekit';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { title, description, hostName, hostEmail } = await request.json();

    if (!title || !hostName) {
      return NextResponse.json(
        { error: 'Title and host name are required' },
        { status: 400 }
      );
    }

    // Generate unique room name
    const roomName = `room-${randomBytes(8).toString('hex')}`;

    // Create or find host user
    let host = await db.user.findUnique({
      where: { email: hostEmail || 'host@example.com' },
    });

    if (!host) {
      host = await db.user.create({
        data: {
          email: hostEmail || 'host@example.com',
          name: hostName,
          role: 'admin',
        },
      });
    }

    // Create meeting
    const meeting = await db.meeting.create({
      data: {
        title,
        description,
        roomName,
        hostId: host.id,
      },
      include: {
        host: true,
      },
    });

    // Add host as participant (IMPORTANT: return this value)
    const participant = await db.participant.create({
      data: {
        meetingId: meeting.id,
        userId: host.id,
        identity: `host-${host.id}`,
        name: hostName,
        role: 'host',
        permissions: 'participant',
      },
    });

    // Generate token for host
    const tokenData = await generateToken({
      roomName: meeting.roomName,
      participantName: hostName,
      identity: `host-${host.id}`,
      role: 'host',
    });
    console.log("ENV CHECK:", {
      key: process.env.LIVEKIT_API_KEY,
      secret: process.env.LIVEKIT_API_SECRET,
      url: process.env.LIVEKIT_WS_URL,
    });
    console.log("FINAL TOKEN =", tokenData.token);
console.log("TYPE =", typeof tokenData.token);

    

    // FIX: Return participant to frontend
    return NextResponse.json({
      meeting: {
        id: meeting.id,
        title: meeting.title,
        description: meeting.description,
        roomName: meeting.roomName,
        startTime: meeting.startTime,
        hostName: hostName,
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
    console.error('Error creating meeting:', error);
    return NextResponse.json(
      { error: 'Failed to create meeting' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const meetings = await db.meeting.findMany({
      where: { isActive: true },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            participants: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    return NextResponse.json({ meetings });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meetings' },
      { status: 500 }
    );
  }
}