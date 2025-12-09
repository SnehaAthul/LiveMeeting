'use client';

import { useSearchParams } from 'next/navigation';
import { LiveRoom } from '@/components/LiveRoom';
import { useEffect, useState } from 'react';

export default function RecordingPage({ params }: { params: { roomName: string } }) {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const hostIdentity = searchParams.get('host') || '';
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        console.log('=== Recording Page Loaded ===');
        console.log('Room Name:', params.roomName);
        console.log('Token:', token ? 'Present' : 'Missing');
        console.log('Host Identity:', hostIdentity);
        console.log('Server URL:', process.env.NEXT_PUBLIC_LIVEKIT_URL);

        // Hide scrollbars and optimize for recording
        document.body.style.overflow = 'hidden';
        document.body.style.margin = '0';
        document.body.style.padding = '0';

        // Verify required params
        if (!token) {
            setError('Missing token');
            return;
        }

        if (!params.roomName) {
            setError('Missing room name');
            return;
        }

        // Give the page a moment to fully render before recording starts
        setTimeout(() => {
            console.log('Recording page ready');
            setIsReady(true);
        }, 2000);

        return () => {
            document.body.style.overflow = '';
            document.body.style.margin = '';
            document.body.style.padding = '';
        };
    }, [token, params.roomName, hostIdentity]);

    if (error || !token) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-900">
                <p className="text-white">Invalid recording token: {error || 'Token missing'}</p>
            </div>
        );
    }

    if (!isReady) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-white">Initializing recording...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-slate-900 overflow-hidden">
            <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          overflow: hidden !important;
        }
        header, footer, nav {
          display: none !important;
        }
        #__next {
          height: 100vh;
          width: 100vw;
        }
        nextjs-portal {
         display: none !important;
        }
        #__next-build-error-overlay,
        #__next-route-announcer__,
        [data-nextjs-toast] {
         display: none !important;
        }
      `}</style>

            <LiveRoom
                token={token}
                serverUrl="ws://localhost:7880"
                roomName={params.roomName}
                participantRole="viewer"
                participantIdentity={`recorder-bot-${Date.now()}`}
                hostIdentity={hostIdentity}
                meetingId=""
                participantId=""
                onLeave={() => {
                    console.log('Recording ended');
                }}
            />
        </div>
    );
}