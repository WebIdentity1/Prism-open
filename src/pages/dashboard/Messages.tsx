import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MessageSquare, Plus, Send, Mail, Phone, Monitor, Users, Filter, ArrowUpDown, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Conversation = {
  id: string;
  type: string;
  subject: string | null;
  created_at: string;
  updated_at: string;
  participants: { user_id: string; profile: { full_name: string; avatar_url: string | null } }[];
  lastMessage?: { body: string; created_at: string };
  unreadCount?: number;
};

type Message = {
  id: string;
  sender_id: string;
  body: string;
  delivery_channel: string;
  is_read: boolean;
  created_at: string;
  sender?: { full_name: string; avatar_url: string | null };
};

export default function Messages() {
  const { user, role } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [channel, setChannel] = useState<"platform" | "email" | "sms">("platform");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newConvoOpen, setNewConvoOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ user_id: string; full_name: string }[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [isBroadcast, setIsBroadcast] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [filterMode, setFilterMode] = useState<"all" | "unread" | "read">("all");
  const [sortMode, setSortMode] = useState<"newest" | "oldest" | "unread-first">("newest");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch conversations
  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      try {
        const { data: participations } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", user.id);

        if (!participations?.length) {
          setConversations([]);
          setLoading(false);
          return;
        }

        const convoIds = participations.map((p) => p.conversation_id);

        const { data: convos } = await supabase
          .from("conversations")
          .select("*")
          .in("id", convoIds)
          .order("updated_at", { ascending: false });

        // Enrich with participants and last message
        const enriched = await Promise.all(
          (convos || []).map(async (c) => {
            const { data: parts } = await supabase
              .from("conversation_participants")
              .select("user_id")
              .eq("conversation_id", c.id);

            const userIds = parts?.map((p) => p.user_id).filter((id) => id !== user.id) || [];

            const { data: profiles } = await supabase
              .from("profiles")
              .select("user_id, full_name, avatar_url")
              .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

            const { data: lastMsg } = await supabase
              .from("messages")
              .select("body, created_at")
              .eq("conversation_id", c.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const { count } = await supabase
              .from("messages")
              .select("*", { count: "exact", head: true })
              .eq("conversation_id", c.id)
              .eq("is_read", false)
              .neq("sender_id", user.id);

            return {
              ...c,
              participants: (profiles || []).map((p) => ({ user_id: p.user_id, profile: p })),
              lastMessage: lastMsg || undefined,
              unreadCount: count || 0,
            };
          })
        );

        setConversations(enriched);
      } catch (err) {
        console.error("Failed to fetch conversations:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [user]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConvo) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConvo.id)
        .order("created_at", { ascending: true });

      // Get sender profiles
      const senderIds = [...new Set(data?.map((m) => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", senderIds);

      const enriched = (data || []).map((m) => ({
        ...m,
        sender: profiles?.find((p) => p.user_id === m.sender_id),
      }));

      setMessages(enriched);

      // Mark as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", selectedConvo.id)
        .neq("sender_id", user?.id);
    };

    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`messages-${selectedConvo.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConvo.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url")
            .eq("user_id", newMsg.sender_id)
            .single();

          setMessages((prev) => [...prev, { ...newMsg, sender: profile }]);

          // Mark as read if not from current user
          if (newMsg.sender_id !== user?.id) {
            await supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", newMsg.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConvo, user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch available users for new conversation
  useEffect(() => {
    if (!newConvoOpen || !user) return;

    const fetchUsers = async () => {
      // For clients, show stylists; for stylists/admins, show clients
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .neq("user_id", user.id);

      setAvailableUsers(profiles || []);
    };

    fetchUsers();
  }, [newConvoOpen, user]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConvo || !user) return;

    setSending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("send-message", {
        body: {
          conversationId: selectedConvo.id,
          body: newMessage,
          channel,
        },
      });

      if (response.error) throw response.error;
      setNewMessage("");
    } catch (err: any) {
      toast.error("Failed to send message: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const startNewConversation = async () => {
    if (!selectedRecipients.length || !user) return;

    setSending(true);
    try {
      const response = await supabase.functions.invoke("send-message", {
        body: {
          recipientIds: selectedRecipients,
          body: newMessage || "Started a conversation",
          channel,
          subject: newSubject || null,
          type: isBroadcast ? "broadcast" : "direct",
        },
      });

      if (response.error) throw response.error;

      setNewConvoOpen(false);
      setSelectedRecipients([]);
      setNewSubject("");
      setNewMessage("");
      toast.success("Conversation started!");

      // Refresh conversations
      window.location.reload();
    } catch (err: any) {
      toast.error("Failed to start conversation: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const getConvoTitle = (convo: Conversation) => {
    if (convo.subject) return convo.subject;
    if (convo.type === "broadcast") return "Broadcast";
    return convo.participants.map((p) => p.profile.full_name || "Unknown").join(", ") || "Conversation";
  };

  const filteredConversations = conversations
    .filter((c) => {
      if (filterMode === "unread") return (c.unreadCount ?? 0) > 0;
      if (filterMode === "read") return (c.unreadCount ?? 0) === 0;
      return true;
    })
    .filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const title = getConvoTitle(c).toLowerCase();
      const lastMsg = c.lastMessage?.body?.toLowerCase() || "";
      return title.includes(q) || lastMsg.includes(q);
    })
    .sort((a, b) => {
      if (sortMode === "unread-first") {
        const aUnread = a.unreadCount ?? 0;
        const bUnread = b.unreadCount ?? 0;
        if (bUnread !== aUnread) return bUnread - aUnread;
      }
      const aTime = new Date(a.updated_at).getTime();
      const bTime = new Date(b.updated_at).getTime();
      return sortMode === "oldest" ? aTime - bTime : bTime - aTime;
    });

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case "email":
        return <Mail className="h-3 w-3" />;
      case "sms":
        return <Phone className="h-3 w-3" />;
      default:
        return <Monitor className="h-3 w-3" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Messages</h1>
          <p className="text-muted-foreground font-normal">Communicate with {role === "client" ? "your stylists" : "clients and staff"}</p>
        </div>
        <Dialog open={newConvoOpen} onOpenChange={setNewConvoOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-prism text-white rounded-full">
              <Plus className="h-4 w-4 mr-2" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New Conversation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {(role === "salon_admin") && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="broadcast"
                    checked={isBroadcast}
                    onChange={(e) => setIsBroadcast(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="broadcast" className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Broadcast to multiple recipients
                  </Label>
                </div>
              )}

              <div className="space-y-2">
                <Label>Recipients</Label>
                <Select
                  value={selectedRecipients[0] || ""}
                  onValueChange={(val) => {
                    if (isBroadcast) {
                      setSelectedRecipients((prev) =>
                        prev.includes(val) ? prev.filter((r) => r !== val) : [...prev, val]
                      );
                    } else {
                      setSelectedRecipients([val]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name || "Unknown User"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isBroadcast && selectedRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedRecipients.map((id) => {
                      const u = availableUsers.find((x) => x.user_id === id);
                      return (
                        <Badge key={id} variant="secondary" className="cursor-pointer" onClick={() => setSelectedRecipients((prev) => prev.filter((r) => r !== id))}>
                          {u?.full_name || id} ×
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Subject (optional)</Label>
                <Input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Conversation subject..."
                />
              </div>

              <div className="space-y-2">
                <Label>Delivery Channel</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        In-App
                      </div>
                    </SelectItem>
                    <SelectItem value="email">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </div>
                    </SelectItem>
                    <SelectItem value="sms">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        SMS
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={3}
                />
              </div>

              <Button
                onClick={startNewConversation}
                disabled={!selectedRecipients.length || !newMessage.trim() || sending}
                className="w-full"
              >
                {sending ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-16rem)]">
        {/* Conversation List */}
        <Card className="glass rounded-xl border-0 lg:col-span-1">
          <CardHeader className="pb-2 space-y-3">
            <CardTitle className="text-base font-medium">Conversations</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterMode} onValueChange={(v) => setFilterMode(v as typeof filterMode)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as typeof sortMode)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <ArrowUpDown className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="unread-first">Unread First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-26rem)]">
              {filteredConversations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{conversations.length === 0 ? "No conversations yet" : "No matching conversations"}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredConversations.map((convo) => (
                    <button
                      key={convo.id}
                      onClick={() => setSelectedConvo(convo)}
                      className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                        selectedConvo?.id === convo.id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={convo.participants[0]?.profile.avatar_url || undefined} />
                          <AvatarFallback>
                            {convo.type === "broadcast" ? (
                              <Users className="h-4 w-4" />
                            ) : (
                              (convo.participants[0]?.profile.full_name?.[0] || "?")
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">{getConvoTitle(convo)}</p>
                            {(convo.unreadCount ?? 0) > 0 && (
                              <Badge className="ml-2">{convo.unreadCount}</Badge>
                            )}
                          </div>
                          {convo.lastMessage && (
                            <p className="text-sm text-muted-foreground truncate">
                              {convo.lastMessage.body}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(convo.updated_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat View */}
        <Card className="glass rounded-xl border-0 lg:col-span-2 flex flex-col">
          {selectedConvo ? (
            <>
              <CardHeader className="border-b pb-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={selectedConvo.participants[0]?.profile.avatar_url || undefined} />
                    <AvatarFallback>
                      {selectedConvo.type === "broadcast" ? (
                        <Users className="h-4 w-4" />
                      ) : (
                        (selectedConvo.participants[0]?.profile.full_name?.[0] || "?")
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{getConvoTitle(selectedConvo)}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedConvo.participants.length} participant{selectedConvo.participants.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isOwn = msg.sender_id === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              isOwn
                                ? "bg-gradient-prism text-white"
                                : "glass"
                            }`}
                          >
                            {!isOwn && (
                              <p className="text-xs font-medium mb-1">
                                {msg.sender?.full_name || "Unknown"}
                              </p>
                            )}
                            <p className="text-sm">{msg.body}</p>
                            <div className="flex items-center gap-1 mt-1 opacity-70">
                              {getChannelIcon(msg.delivery_channel)}
                              <span className="text-xs">
                                {format(new Date(msg.created_at), "h:mm a")}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="glass-subtle border-t p-4">
                  <div className="flex gap-2">
                    <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                      <SelectTrigger className="w-28 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="platform">
                          <div className="flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            In-App
                          </div>
                        </SelectItem>
                        <SelectItem value="email">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            Email
                          </div>
                        </SelectItem>
                        <SelectItem value="sms">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            SMS
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      className="flex-1 rounded-lg"
                    />
                    <Button onClick={sendMessage} disabled={!newMessage.trim() || sending} className="bg-gradient-prism text-white rounded-full">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Select a conversation or start a new one</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
