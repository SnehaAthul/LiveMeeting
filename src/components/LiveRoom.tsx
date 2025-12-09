'use client';

import { useEffect, useState, useRef } from 'react';
import { Room, RoomEvent, RemoteParticipant, RemoteTrack, RemoteTrackPublication, LocalVideoTrack, LocalAudioTrack, Track, DisconnectReason } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, Users, Eye, Phone, Settings, Circle, Square, Pin, PinOff
} from 'lucide-react';

interface LiveRoomProps {
  token: string;
  serverUrl: string;
  roomName: string;
  participantRole: string;
  participantIdentity: string;
  meetingId?: string;
  participantId?: string;
  hostIdentity: string;
  onLeave: () => void;
}

interface Participant {
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
  videoTrack?: LocalVideoTrack | RemoteTrack;
  audioTrack?: LocalAudioTrack | RemoteTrack;
  isMuted?: boolean;
  isVideoOff?: boolean;
}

export function LiveRoom({
  token,
  serverUrl,
  roomName,
  participantRole,
  participantIdentity,
  meetingId,
  participantId,
  hostIdentity,
  onLeave
}: LiveRoomProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localThumbnailRef = useRef<HTMLVideoElement>(null);
  const isHost = participantRole === 'host';
  const isViewer = participantRole === 'viewer';
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  useEffect(() => {
    if (!token || !serverUrl) return;

    const connectToRoom = async () => {
      try {
        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: { width: 1280, height: 720 },
          },
        });

        newRoom.on(RoomEvent.Connected, () => {
          console.log('Connected to room:', roomName);
          setIsConnected(true);
          setError(null);
        });

        newRoom.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
          console.log('Disconnected from room, reason:', reason);
          setIsConnected(false);

          // If the room was deleted (host ended meeting), redirect all participants
          if (reason === DisconnectReason.ROOM_DELETED) {
            setTimeout(() => {
              alert('The host has ended the meeting');
              onLeave();
            }, 500);
          }
        });

        newRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          console.log('Participant connected:', participant.identity);
          updateParticipantsList(newRoom);
        });

        newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          console.log('Participant disconnected:', participant.identity);

          // Clean up video ref immediately
          if (remoteVideoRefs.current[participant.identity]) {
            delete remoteVideoRefs.current[participant.identity];
          }

          // Unpin if this participant was pinned
          if (pinnedParticipant === participant.identity) {
            setPinnedParticipant(null);
          }

          // Force immediate participant list update
          updateParticipantsList(newRoom);
        });

        newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log("Track subscribed:", track.kind, "from", participant.identity, "source:", publication.source);

          if (track.kind === Track.Kind.Video || track.kind === Track.Kind.ScreenShare) {
            // Attach to thumbnail
            const vid = remoteVideoRefs.current[participant.identity];
            if (vid) {
              track.attach(vid);
            }

            // CRITICAL: For screen shares, force immediate update to main view
            if (publication.source === Track.Source.ScreenShare) {
              console.log('🖥️ Screen share detected from', participant.identity);

              // Force re-render to update main video
              updateParticipantsList(newRoom);

              // For recording bot, immediately attach screen share
              if (isViewer && mainVideoRef.current) {
                console.log('📹 Recording bot: Attaching screen share immediately');
                setTimeout(() => {
                  if (mainVideoRef.current && track) {
                    track.attach(mainVideoRef.current);
                  }
                }, 100);
              }
            }

            // If pinned participant, attach to main
            if (pinnedParticipant === participant.identity && mainVideoRef.current) {
              track.attach(mainVideoRef.current);
            }
          }

          updateParticipantsList(newRoom);
        });

        newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          console.log("Track unsubscribed:", track.kind, "source:", publication?.source);
          track.detach();

          // If screen share ended, force update to switch back to camera
          if (publication?.source === Track.Source.ScreenShare) {
            console.log('Screen share ended from', participant?.identity);
            updateParticipantsList(newRoom);
          }

          updateParticipantsList(newRoom);
        });

        newRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers: RemoteParticipant[]) => {
          updateParticipantsList(newRoom);
        });

        newRoom.on(RoomEvent.LocalTrackPublished, (publication) => {
          console.log('Local track published:', publication.source);

          if (publication.source === Track.Source.ScreenShare) {
            setIsScreenSharing(true);
            publication.track?.once('ended', () => {
              console.log('Screen share ended by user');
              setIsScreenSharing(false);
            });
          }
          updateParticipantsList(newRoom);
        });

        newRoom.on(RoomEvent.LocalTrackUnpublished, (publication) => {
          console.log('Local track unpublished:', publication.source);
          if (publication.source === Track.Source.ScreenShare) {
            setIsScreenSharing(false);
          }
          updateParticipantsList(newRoom);
        });

        newRoom.on(RoomEvent.TrackMuted, (publication, participant) => {
          // Only update local UI state for *this* tab
          if (!participant.isLocal) {
            // Remote participant muted -> update participants list only
            updateParticipantsList(newRoom);
            return;
          }

          if (publication.source === Track.Source.Camera) {
            console.log('Camera muted (local)');
            setIsVideoOff(true);
          } else if (publication.source === Track.Source.Microphone) {
            console.log('Microphone muted (local)');
            setIsMuted(true);
          }

          updateParticipantsList(newRoom);
        });

        newRoom.on(RoomEvent.TrackUnmuted, (publication, participant) => {
          // Only update local UI state for *this* tab
          if (!participant.isLocal) {
            updateParticipantsList(newRoom);
            return;
          }

          if (publication.source === Track.Source.Camera) {
            console.log('Camera unmuted (local)');
            setIsVideoOff(false);

            // Re-attach to main video if pinned
            setTimeout(() => {
              if (publication.track && mainVideoRef.current) {
                const isPinnedLocal =
                  pinnedParticipant === newRoom.localParticipant.identity;
                const isPinnedRemote =
                  publication.participant &&
                  pinnedParticipant === publication.participant.identity;

                if (isPinnedLocal || isPinnedRemote) {
                  console.log('Re-attaching camera to main after unmute');
                  publication.track.attach(mainVideoRef.current);
                }
              }
            }, 100);
          } else if (publication.source === Track.Source.Microphone) {
            console.log('Microphone unmuted (local)');
            setIsMuted(false);
          }

          updateParticipantsList(newRoom);
        });


        await newRoom.connect(serverUrl, token);
        setRoom(newRoom);

        if (!isViewer) {
          await newRoom.localParticipant.enableCameraAndMicrophone();
          // Attach local camera to both refs
          const cameraPub = Array.from(
            newRoom.localParticipant.trackPublications.values()
          ).find((pub) => pub.source === Track.Source.Camera);

          if (cameraPub?.track) {
            if (isHost && localVideoRef.current) {
              cameraPub.track.attach(localVideoRef.current);
            }
            if (localThumbnailRef.current) {
              cameraPub.track.attach(localThumbnailRef.current);
            }
          }
          setIsMuted(!newRoom.localParticipant.isMicrophoneEnabled);
          setIsVideoOff(!newRoom.localParticipant.isCameraEnabled);
        }

        updateParticipantsList(newRoom);

      } catch (err) {
        console.error('Failed to connect to room:', err);
        setError('Failed to connect to the meeting room');
      }
    };

    connectToRoom();

    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [token, serverUrl, roomName, isViewer, isHost]);

  useEffect(() => {
    if (!room || !mainVideoRef.current) return;

    const run = async () => {
      const mainEl = mainVideoRef.current;
      if (!mainEl) return;

      // Clear previous content
      mainEl.srcObject = null;
      mainEl.removeAttribute('src');
      mainEl.load();

      let participantToShow: any = null;

      // PRIORITY 1: Pinned participant
      if (pinnedParticipant) {
        if (room.localParticipant.identity === pinnedParticipant) {
          participantToShow = room.localParticipant;
        } else {
          participantToShow = room.remoteParticipants.get(pinnedParticipant);
        }
      }
      // PRIORITY 2: For recording bot, find screen share first
      else if (isViewer) {
        // Check ALL participants for active screen share
        const allParticipants = [
          ...Array.from(room.remoteParticipants.values())
        ];

        const screenShareParticipant = allParticipants.find(p => {
          const hasScreenShare = Array.from(p.trackPublications.values()).some(
            pub => pub.source === Track.Source.ScreenShare && pub.track && !pub.isMuted
          );
          return hasScreenShare;
        });

        if (screenShareParticipant) {
          participantToShow = screenShareParticipant;
          console.log('Recording: Showing screen share from', screenShareParticipant.identity);
        } else if (hostIdentity) {
          participantToShow = room.remoteParticipants.get(hostIdentity);
          console.log('Recording: Showing host', hostIdentity);
        } else {
          participantToShow = allParticipants[0];
          console.log('Recording: Showing first participant');
        }
      }
      // PRIORITY 3: For regular users
      else {
        if (isHost) {
          participantToShow = room.localParticipant;
        } else {
          participantToShow = room.remoteParticipants.get(hostIdentity) ??
            Array.from(room.remoteParticipants.values())[0];
        }
      }

      if (!participantToShow) return;

      // Get publications
      const publications = Array.from(participantToShow.trackPublications.values());

      // ALWAYS prefer screen share over camera
      const screenPub = publications.find(
        p => p.source === Track.Source.ScreenShare && p.track && !p.isMuted
      );

      const cameraPub = publications.find(
        p => p.source === Track.Source.Camera && p.track && !p.isMuted
      );

      const trackToAttach = (screenPub?.track as any) || (cameraPub?.track as any);

      if (trackToAttach) {
        const trackType = screenPub ? 'SCREEN' : 'CAMERA';
        console.log('Attaching to main:', participantToShow.identity, trackType);

        await new Promise(resolve => setTimeout(resolve, 50));
        trackToAttach.attach(mainEl);
      }
    };

    run();
  }, [pinnedParticipant, room, isHost, hostIdentity, isViewer]);


  const updateParticipantsList = (currentRoom: Room) => {
    const newList: Participant[] = [
      {
        identity: currentRoom.localParticipant.identity,
        name: currentRoom.localParticipant.name || currentRoom.localParticipant.identity,
        isLocal: true,
        isSpeaking: currentRoom.localParticipant.isSpeaking,
        videoTrack: currentRoom.localParticipant.videoTrack || undefined,
        audioTrack: currentRoom.localParticipant.audioTrack || undefined,
        isMuted: currentRoom.localParticipant.isMicrophoneEnabled === false,
        isVideoOff: currentRoom.localParticipant.isCameraEnabled === false,
      },
      ...Array.from(currentRoom.remoteParticipants.values())
        .filter((participant) =>
          !participant.identity.startsWith('recorder-bot') &&
          !participant.identity.startsWith('recorder-')
        )
        .map((participant) => ({
          identity: participant.identity,
          name: participant.name || participant.identity,
          isLocal: false,
          isSpeaking: participant.isSpeaking,
          videoTrack: participant.videoTrack || undefined,
          audioTrack: participant.audioTrack || undefined,
          isMuted: participant.isMicrophoneEnabled === false,
          isVideoOff: participant.isCameraEnabled === false,
        })),
    ];

    // only update state if list actually changed
    setParticipants(prevList => {
      const changed = JSON.stringify(prevList.map(p => p.identity)) !==
        JSON.stringify(newList.map(p => p.identity));
      return changed ? newList : prevList;
    });
  };

  const toggleMicrophone = async () => {
    if (!room || isViewer) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
    } catch (err) {
      console.error('Failed to toggle microphone:', err);
    }
  };

  const toggleCamera = async () => {
    if (!room || isViewer) return;
    try {
      const currentState = room.localParticipant.isCameraEnabled;
      await room.localParticipant.setCameraEnabled(!currentState);

      await new Promise(resolve => setTimeout(resolve, 100));

      if (!currentState) {
        const cameraPub = Array.from(
          room.localParticipant.trackPublications.values()
        ).find((pub) => pub.source === Track.Source.Camera);

        if (cameraPub?.track) {
          if (isHost && localVideoRef.current) {
            cameraPub.track.attach(localVideoRef.current);
          }
          if (localThumbnailRef.current) {
            cameraPub.track.attach(localThumbnailRef.current);
          }
          if (pinnedParticipant === room.localParticipant.identity && mainVideoRef.current) {
            cameraPub.track.attach(mainVideoRef.current);
          }
        }
      }
    } catch (err) {
      console.error('Failed to toggle camera:', err);
    }
  };

  const toggleScreenShare = async () => {
    if (!room || isViewer) return;
    try {
      const currentState = room.localParticipant.isScreenShareEnabled;
      await room.localParticipant.setScreenShareEnabled(!currentState);
    } catch (err) {
      console.error('Failed to toggle screen share:', err);
      setIsScreenSharing(false);
    }
  };

  const toggleRecording = async () => {
    if (!isHost || !meetingId || !participantId) return;
    try {
      const response = await fetch('/api/meetings/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId,
          participantId,
          action: isRecording ? 'stop' : 'start',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to control recording');
      }
      setIsRecording(!isRecording);
    } catch (error: any) {
      console.error('Failed to toggle recording:', error);
    }
  };

  const handlePinParticipant = (identity: string) => {
    if (pinnedParticipant === identity) {
      setPinnedParticipant(null);
    } else {
      setPinnedParticipant(identity);
    }
  };

  const getMainVideoParticipant = () => {
    if (pinnedParticipant !== null) {
      return participants.find(p => p.identity === pinnedParticipant);
    }
    if (isHost) {
      return participants.find(p => p.isLocal);
    } else {
      return participants.find(p => !p.isLocal && p.identity === hostIdentity) ||
        participants.find(p => !p.isLocal);
    }
  };

  const mainParticipant = getMainVideoParticipant();

  if (error) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={onLeave}>Leave Meeting</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5 h-[88vh]">
      <div className="lg:col-span-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-0">
            <div className="bg-slate-900 rounded-lg overflow-hidden relative h-[70vh]">
              {mainParticipant?.isLocal ? (
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              ) : (
                <video ref={mainVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              )}

              {((mainParticipant?.isLocal && isVideoOff) || mainParticipant?.isVideoOff) && (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-900">
                  <div className="text-center">
                    <VideoOff className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">Camera is off</p>
                  </div>
                </div>
              )}

              <div className="absolute top-4 left-4">
                <Badge variant={isConnected ? "default" : "destructive"}>
                  {isConnected ? 'Connected' : 'Connecting...'}
                </Badge>
              </div>

              {pinnedParticipant !== null && (
                <div className="absolute top-4 right-4">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Pin className="h-3 w-3" />
                    Pinned
                  </Badge>
                </div>
              )}

              <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded">
                <p className="text-white text-sm">
                  {mainParticipant?.name || 'Unknown'}
                  {mainParticipant?.isLocal && ' (You)'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-800 border-t border-slate-700">
              <div className="flex items-center justify-center gap-2">
                {!isViewer && (
                  <>
                    <Button variant={isMuted ? "destructive" : "secondary"} size="sm" onClick={toggleMicrophone} disabled={!isConnected}>
                      {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button variant={isVideoOff ? "destructive" : "secondary"} size="sm" onClick={toggleCamera} disabled={!isConnected}>
                      {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                    </Button>
                    <Button variant={isScreenSharing ? "default" : "secondary"} size="sm" onClick={toggleScreenShare} disabled={!isConnected}>
                      {isScreenSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                    </Button>
                    {isHost && (
                      <Button variant={isRecording ? "destructive" : "secondary"} size="sm" onClick={toggleRecording} disabled={!isConnected} className="relative">
                        {isRecording ? (
                          <>
                            <Square className="h-4 w-4" />
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          </>
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </>
                )}
                <Separator orientation="vertical" className="h-6" />
              </div>
              {isRecording && (
                <div className="mt-3 text-center">
                  <Badge variant="destructive" className="animate-pulse">
                    <Circle className="h-2 w-2 mr-1 fill-current" />
                    Recording
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(!isHost || pinnedParticipant !== null) && participants
          .filter(p => p.isLocal)
          .map((participant) => (
            <div
              key={participant.identity}
              className={`relative h-40 bg-black rounded-lg overflow-hidden cursor-pointer transition-all ${pinnedParticipant === participant.identity ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-gray-400'
                }`}
              onClick={() => handlePinParticipant(participant.identity)}
            >
              <video ref={localThumbnailRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2">
                {pinnedParticipant === participant.identity ? (
                  <Pin className="h-4 w-4 text-blue-500 fill-blue-500" />
                ) : (
                  <PinOff className="h-4 w-4 text-white/70" />
                )}
              </div>
              <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 text-xs rounded">
                {participant.name} (You)
              </div>
            </div>
          ))}

        {participants
          .filter(p => !p.isLocal)
          .map((participant) => (
            <div
              key={participant.identity}
              className={`relative h-40 bg-black rounded-lg overflow-hidden cursor-pointer transition-all ${pinnedParticipant === participant.identity ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-gray-400'
                }`}
              onClick={() => handlePinParticipant(participant.identity)}
            >
              <video
                ref={(el) => (remoteVideoRefs.current[participant.identity] = el)}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2">
                {pinnedParticipant === participant.identity ? (
                  <Pin className="h-4 w-4 text-blue-500 fill-blue-500" />
                ) : (
                  <PinOff className="h-4 w-4 text-white/70" />
                )}
              </div>
              <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 text-xs rounded">
                {participant.name}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}