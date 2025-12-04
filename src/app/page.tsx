'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, Users, Eye, Plus, LogIn } from 'lucide-react';
import CreateMeetingDialog from '@/components/CreateMeetingDialog';
import JoinMeetingDialog from '@/components/JoinMeetingDialog';
import MeetingList from '@/components/MeetingList';

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Live Streaming Platform
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Create and join live streaming meetings.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-4xl mx-auto">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="create">Create Meeting</TabsTrigger>
            <TabsTrigger value="join">Join Meeting</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-8">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    Host a Meeting
                  </CardTitle>
                  <CardDescription>
                    Create a new live streaming session as a host with full control
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CreateMeetingDialog 
                    trigger={
                      <Button className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Meeting
                      </Button>
                    }
                  />
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Join as Participant
                  </CardTitle>
                  <CardDescription>
                    Join an active meeting to participate with audio, video, and screen sharing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <JoinMeetingDialog 
                    role="participant"
                    trigger={
                      <Button className="w-full" variant="outline">
                        <LogIn className="h-4 w-4 mr-2" />
                        Join as Participant
                      </Button>
                    }
                  />
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Watch as Viewer
                  </CardTitle>
                  <CardDescription>
                    Join a meeting to watch without participating in the conversation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <JoinMeetingDialog 
                    role="viewer"
                    trigger={
                      <Button className="w-full" variant="secondary">
                        <Eye className="h-4 w-4 mr-2" />
                        Watch as Viewer
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </div>

            <div className="mt-12">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                Active Meetings
              </h2>
              <MeetingList />
            </div>
          </TabsContent>

          <TabsContent value="create" className="mt-8">
            <div className="max-w-2xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle>Create New Meeting</CardTitle>
                  <CardDescription>
                    Start a new live streaming session as a host
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CreateMeetingDialog 
                    trigger={
                      <Button className="w-full" size="lg">
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Meeting
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="join" className="mt-8">
            <div className="max-w-2xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle>Join a Meeting</CardTitle>
                  <CardDescription>
                    Enter meeting details to join an active session
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <JoinMeetingDialog 
                    role="participant"
                    trigger={
                      <Button className="w-full" size="lg" variant="outline">
                        <Users className="h-4 w-4 mr-2" />
                        Join as Participant
                      </Button>
                    }
                  />
                  <div className="text-center text-slate-500">or</div>
                  <JoinMeetingDialog 
                    role="viewer"
                    trigger={
                      <Button className="w-full" size="lg" variant="secondary">
                        <Eye className="h-4 w-4 mr-2" />
                        Watch as Viewer
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}