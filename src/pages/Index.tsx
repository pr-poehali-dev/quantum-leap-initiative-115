import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── API URLs ─────────────────────────────────────────────────────────────────
const AUTH_URL = "https://functions.poehali.dev/045283d5-cc24-4e45-a149-c32eaceed2ee";
const USERS_URL = "https://functions.poehali.dev/a208f24f-d280-44fa-8eea-c8dd65ec045e";
const CHATS_URL = "https://functions.poehali.dev/79a637ac-1e74-45fe-b098-2e7b0da598f9";

const api = async (base: string, path: string, opts: RequestInit = {}) => {
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Badge = { id: string; label: string; color: string };
type User = {
  id: string;
  name: string;
  username: string;
  phone?: string;
  avatar: string | null;
  bio: string;
  online: boolean;
  isAdmin: boolean;
  rainbowNick: boolean;
  badges: Badge[];
  banned: boolean;
};
type Message = {
  id: string;
  fromId: string;
  chatId: string;
  text: string;
  image?: string;
  audio?: string;
  timestamp: number;
  fromName?: string;
  fromUsername?: string;
  fromAvatar?: string | null;
  fromRainbow?: boolean;
};
type ChatMember = { id: string; name: string; username: string; avatar: string | null; online: boolean; rainbowNick: boolean };
type Chat = {
  id: string;
  type: "direct" | "group" | "channel";
  name: string | null;
  description: string;
  avatar: string | null;
  ownerId: string | null;
  isChannel: boolean;
  createdAt: number;
  lastMessage: Message | null;
  members: ChatMember[];
  partner: ChatMember | null;
};
type Tab = "chats" | "contacts" | "ai" | "admin" | "settings";
type ModalType = "profile" | "createGroup" | "createChannel" | "joinPublic" | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const WAVE_ACCENT = "#6C63FF";

const formatTime = (ts: number) =>
  new Date(ts * (ts < 9999999999 ? 1000 : 1)).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

const getInitials = (name: string) => name.charAt(0).toUpperCase();

const RainbowText = ({ text }: { text: string }) => (
  <span style={{ background: "linear-gradient(90deg,#ff0000,#ff7700,#ffff00,#00ff00,#0000ff,#8b00ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontWeight: 700 }}>
    {text}
  </span>
);

const AvatarComp = ({ user, size = 40, showOnline = false }: { user: { name: string; avatar: string | null; online?: boolean }; size?: number; showOnline?: boolean }) => (
  <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
    {user.avatar ? (
      <img src={user.avatar} alt={user.name} className="rounded-full object-cover" style={{ width: size, height: size }} />
    ) : (
      <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ width: size, height: size, background: "linear-gradient(135deg,#6C63FF,#a855f7)", fontSize: size * 0.4 }}>
        {getInitials(user.name)}
      </div>
    )}
    {showOnline && user.online !== undefined && (
      <div className={`absolute bottom-0 right-0 rounded-full border-2 border-[#1e1f22] ${user.online ? "bg-[#3ba55c]" : "bg-[#80848e]"}`} style={{ width: size * 0.28, height: size * 0.28 }} />
    )}
  </div>
);

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target?.result as string);
    r.readAsDataURL(file);
  });

// ─── Main ─────────────────────────────────────────────────────────────────────
const Index = () => {
  // auth
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem("wave_user") || "null"); } catch { return null; }
  });

  // forms
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAvatar, setRegAvatar] = useState<string | null>(null);
  const [regError, setRegError] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // main
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [publicChats, setPublicChats] = useState<Chat[]>([]);
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatImage, setChatImage] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  // settings
  const [settingsName, setSettingsName] = useState("");
  const [settingsBio, setSettingsBio] = useState("");
  const [settingsAvatar, setSettingsAvatar] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // admin
  const [adminSearch, setAdminSearch] = useState("");
  const [adminBadgeUserId, setAdminBadgeUserId] = useState<string | null>(null);
  const [adminViewChatId, setAdminViewChatId] = useState<string | null>(null);
  const [adminChatMsgs, setAdminChatMsgs] = useState<Message[]>([]);

  // group creation
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupIsChannel, setNewGroupIsChannel] = useState(false);
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);

  // recording
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // polling
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgTsRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const regAvatarRef = useRef<HTMLInputElement>(null);
  const settingsAvatarRef = useRef<HTMLInputElement>(null);

  // ── Load initial data ──
  const loadData = useCallback(async (user: User) => {
    const [chatsRes, usersRes, badgesRes] = await Promise.all([
      api(CHATS_URL, `/list?userId=${user.id}`),
      api(USERS_URL, "/list"),
      api(USERS_URL, "/badges"),
    ]);
    if (chatsRes.ok) setChats(chatsRes.data.chats || []);
    if (usersRes.ok) setUsers(usersRes.data.users || []);
    if (badgesRes.ok) setAllBadges(badgesRes.data.badges || []);
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadData(currentUser);
      setSettingsName(currentUser.name);
      setSettingsBio(currentUser.bio);
      setSettingsAvatar(currentUser.avatar);
    }
  }, [currentUser, loadData]);

  // ── Message polling ──
  useEffect(() => {
    if (!openChatId || !currentUser) return;

    const loadMsgs = async (since = 0) => {
      const res = await api(CHATS_URL, `/messages?chatId=${openChatId}&since=${since}`);
      if (res.ok && res.data.messages) {
        if (since === 0) {
          setChatMessages(res.data.messages);
        } else if (res.data.messages.length > 0) {
          setChatMessages((prev) => {
            const ids = new Set(prev.map((m: Message) => m.id));
            const newMsgs = res.data.messages.filter((m: Message) => !ids.has(m.id));
            if (newMsgs.length > 0) {
              // Push notification
              if (Notification.permission === "granted") {
                newMsgs.forEach((m: Message) => {
                  if (m.fromId !== currentUser.id) {
                    new Notification(`19 wave — ${m.fromName || "Пользователь"}`, {
                      body: m.audio ? "🎤 Голосовое" : m.image ? "📷 Фото" : m.text,
                      icon: "/favicon.svg",
                    });
                  }
                });
              }
              return [...prev, ...newMsgs];
            }
            return prev;
          });
        }
        if (res.data.messages.length > 0) {
          const last = res.data.messages[res.data.messages.length - 1];
          lastMsgTsRef.current = last.timestamp;
        }
      }
    };

    loadMsgs(0);
    pollRef.current = setInterval(() => loadMsgs(lastMsgTsRef.current), 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [openChatId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Reload chats periodically ──
  useEffect(() => {
    if (!currentUser) return;
    const iv = setInterval(() => loadData(currentUser), 10000);
    return () => clearInterval(iv);
  }, [currentUser, loadData]);

  // ── Request push permission ──
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ─── Auth ──────────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    setRegError("");
    if (!regName.trim()) return setRegError("Введите имя");
    if (!regUsername.startsWith("@") || !/^@[a-z]+$/.test(regUsername)) return setRegError("Юзернейм: @ + только строчные английские буквы");
    if (!regPhone.trim()) return setRegError("Введите номер телефона");
    setAuthLoading(true);
    const res = await api(AUTH_URL, "/register", { method: "POST", body: JSON.stringify({ name: regName.trim(), username: regUsername, phone: regPhone.trim(), avatar: regAvatar }) });
    setAuthLoading(false);
    if (!res.ok) return setRegError(res.data?.error || "Ошибка регистрации");
    const user = res.data.user;
    localStorage.setItem("wave_user", JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogin = async () => {
    setLoginError("");
    setAuthLoading(true);
    const res = await api(AUTH_URL, "/login", { method: "POST", body: JSON.stringify({ phone: loginPhone.trim() }) });
    setAuthLoading(false);
    if (!res.ok) return setLoginError(res.data?.error || "Ошибка входа");
    const user = res.data.user;
    localStorage.setItem("wave_user", JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    if (currentUser) await api(AUTH_URL, "/logout", { method: "POST", body: JSON.stringify({ userId: currentUser.id }) });
    localStorage.removeItem("wave_user");
    setCurrentUser(null);
    setChats([]);
    setUsers([]);
    setOpenChatId(null);
    setChatMessages([]);
  };

  // ─── Chat ──────────────────────────────────────────────────────────────────
  const openDirectChat = async (targetId: string) => {
    if (!currentUser) return;
    const res = await api(CHATS_URL, "/direct", { method: "POST", body: JSON.stringify({ userId: currentUser.id, targetId }) });
    if (res.ok) {
      await loadData(currentUser);
      setOpenChatId(res.data.chatId);
      setActiveTab("chats");
      lastMsgTsRef.current = 0;
    }
  };

  const sendMessage = async () => {
    if (!chatText.trim() && !chatImage) return;
    if (!currentUser || !openChatId) return;
    await api(CHATS_URL, "/messages", {
      method: "POST",
      body: JSON.stringify({ chatId: openChatId, fromId: currentUser.id, text: chatText.trim(), image: chatImage ?? undefined }),
    });
    setChatText("");
    setChatImage(null);
    await loadData(currentUser);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = async (e) => {
          const b64 = e.target?.result as string;
          if (currentUser && openChatId) {
            await api(CHATS_URL, "/messages", { method: "POST", body: JSON.stringify({ chatId: openChatId, fromId: currentUser.id, text: "", audio: b64 }) });
            await loadData(currentUser);
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch { alert("Нет доступа к микрофону"); }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setRecording(false); };

  // ─── Create group/channel ──────────────────────────────────────────────────
  const createGroup = async () => {
    if (!currentUser || !newGroupName.trim()) return;
    const res = await api(CHATS_URL, "/group", {
      method: "POST",
      body: JSON.stringify({ userId: currentUser.id, name: newGroupName.trim(), description: newGroupDesc, isChannel: newGroupIsChannel, memberIds: newGroupMembers }),
    });
    if (res.ok) {
      setModal(null);
      setNewGroupName("");
      setNewGroupDesc("");
      setNewGroupMembers([]);
      await loadData(currentUser);
      setOpenChatId(res.data.chatId);
    }
  };

  const joinChat = async (chatId: string) => {
    if (!currentUser) return;
    await api(CHATS_URL, "/join", { method: "POST", body: JSON.stringify({ userId: currentUser.id, chatId }) });
    await loadData(currentUser);
    setOpenChatId(chatId);
    setModal(null);
  };

  const loadPublicChats = async () => {
    const res = await api(CHATS_URL, `/public?userId=${currentUser?.id || ""}`);
    if (res.ok) setPublicChats(res.data.chats || []);
    setModal("joinPublic");
  };

  // ─── Settings ──────────────────────────────────────────────────────────────
  const saveSettings = async () => {
    if (!currentUser || !settingsName.trim()) return;
    await api(USERS_URL, "/update", {
      method: "PUT",
      body: JSON.stringify({ userId: currentUser.id, name: settingsName.trim(), bio: settingsBio, avatar: settingsAvatar }),
    });
    const updated = { ...currentUser, name: settingsName.trim(), bio: settingsBio, avatar: settingsAvatar };
    setCurrentUser(updated);
    localStorage.setItem("wave_user", JSON.stringify(updated));
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  // ─── Admin ─────────────────────────────────────────────────────────────────
  const adminBan = async (id: string) => {
    await api(USERS_URL, "/admin/ban", { method: "POST", body: JSON.stringify({ targetId: id }) });
    if (currentUser) await loadData(currentUser);
  };
  const adminRainbow = async (id: string) => {
    await api(USERS_URL, "/admin/rainbow", { method: "POST", body: JSON.stringify({ targetId: id }) });
    if (currentUser) await loadData(currentUser);
  };
  const adminGiveBadge = async (userId: string, badgeId: string) => {
    await api(USERS_URL, "/admin/badge", { method: "POST", body: JSON.stringify({ targetId: userId, badgeId }) });
    if (currentUser) await loadData(currentUser);
  };
  const adminViewChat = async (chatId: string) => {
    if (adminViewChatId === chatId) { setAdminViewChatId(null); return; }
    const res = await api(CHATS_URL, `/admin/messages?chatId=${chatId}`);
    if (res.ok) setAdminChatMsgs(res.data.messages || []);
    setAdminViewChatId(chatId);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}>
              <span className="text-white text-3xl font-black">19</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">19 wave</h1>
            <p className="text-[#8e9297] mt-1 text-sm">Мессенджер нового поколения</p>
          </div>
          <div className="bg-[#2b2d31] rounded-2xl p-6 shadow-2xl">
            <div className="flex bg-[#1e1f22] rounded-xl p-1 mb-6">
              {(["login", "register"] as const).map((m) => (
                <button key={m} onClick={() => { setAuthMode(m); setLoginError(""); setRegError(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${authMode === m ? "bg-[#6C63FF] text-white" : "text-[#8e9297] hover:text-white"}`}>
                  {m === "login" ? "Войти" : "Регистрация"}
                </button>
              ))}
            </div>
            {authMode === "register" ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <button onClick={() => regAvatarRef.current?.click()} className="relative group">
                    {regAvatar ? <img src={regAvatar} alt="avatar" className="w-20 h-20 rounded-full object-cover" /> : (
                      <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-2 border-dashed border-[#6C63FF] text-[#6C63FF] hover:bg-[#6C63FF]/10 transition-all">
                        <Icon name="Camera" size={24} /><span className="text-xs mt-1">Фото</span>
                      </div>
                    )}
                    <input ref={regAvatarRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRegAvatar(await readFileAsBase64(f)); }} />
                  </button>
                </div>
                <input className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66]" placeholder="Ваше имя" value={regName} onChange={(e) => setRegName(e.target.value)} />
                <input className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66]" placeholder="@username" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} />
                <input className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66]" placeholder="Номер телефона" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} />
                {regError && <p className="text-[#ed4245] text-xs">{regError}</p>}
                <button onClick={handleRegister} disabled={authLoading} className="w-full py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 disabled:opacity-60" style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}>
                  {authLoading ? "Создание..." : "Создать аккаунт"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <input className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66]" placeholder="Номер телефона" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
                {loginError && <p className="text-[#ed4245] text-xs">{loginError}</p>}
                <button onClick={handleLogin} disabled={authLoading} className="w-full py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 disabled:opacity-60" style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}>
                  {authLoading ? "Вход..." : "Войти"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODALS
  // ─────────────────────────────────────────────────────────────────────────
  if (modal === "profile" && profileUserId) {
    const pu = users.find((u) => u.id === profileUserId) || (currentUser.id === profileUserId ? currentUser : null);
    if (!pu) { setModal(null); return null; }
    return (
      <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#2b2d31] rounded-2xl overflow-hidden shadow-2xl">
          <div className="h-24 relative" style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}>
            <button onClick={() => setModal(null)} className="absolute top-3 right-3 text-white/70 hover:text-white"><Icon name="X" size={20} /></button>
            <div className="absolute -bottom-8 left-4"><AvatarComp user={pu} size={64} /></div>
          </div>
          <div className="pt-12 px-4 pb-4">
            <div className="mb-3">
              {pu.rainbowNick ? <RainbowText text={pu.name} /> : <span className="text-white text-xl font-bold">{pu.name}</span>}
              <p className="text-[#8e9297] text-sm">{pu.username}</p>
              {pu.bio && <p className="text-[#dcddde] text-sm mt-2">{pu.bio}</p>}
            </div>
            {pu.badges && pu.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {pu.badges.map((b) => <span key={b.id} className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: b.color }}>{b.label}</span>)}
              </div>
            )}
            {pu.id !== currentUser.id && (
              <button onClick={() => { setModal(null); openDirectChat(pu.id); }} className="mt-4 w-full py-2 rounded-xl text-white text-sm font-semibold" style={{ background: WAVE_ACCENT }}>Написать</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (modal === "createGroup" || modal === "createChannel") {
    const isChannel = modal === "createChannel";
    return (
      <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#2b2d31] rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-lg">{isChannel ? "Новый канал" : "Новая группа"}</h2>
            <button onClick={() => setModal(null)} className="text-[#8e9297] hover:text-white"><Icon name="X" size={20} /></button>
          </div>
          <div className="space-y-3">
            <input className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66]" placeholder="Название" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
            <textarea className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] resize-none placeholder-[#5c5f66]" placeholder="Описание (необязательно)" rows={2} value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} />
            {!isChannel && (
              <div>
                <p className="text-[#8e9297] text-xs mb-2">Добавить участников:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {users.filter((u) => u.id !== currentUser.id).map((u) => (
                    <label key={u.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[#383a40] cursor-pointer">
                      <input type="checkbox" checked={newGroupMembers.includes(u.id)} onChange={(e) => setNewGroupMembers(e.target.checked ? [...newGroupMembers, u.id] : newGroupMembers.filter((id) => id !== u.id))} className="accent-[#6C63FF]" />
                      <AvatarComp user={u} size={28} />
                      <span className="text-white text-sm">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => { setNewGroupIsChannel(isChannel); createGroup(); }} className="w-full py-3 rounded-xl text-white font-semibold" style={{ background: WAVE_ACCENT }}>
              {isChannel ? "Создать канал" : "Создать группу"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (modal === "joinPublic") {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex flex-col p-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setModal(null)} className="text-[#8e9297] hover:text-white"><Icon name="ArrowLeft" size={20} /></button>
          <h2 className="text-white font-bold text-lg">Группы и каналы</h2>
        </div>
        <div className="space-y-3">
          {publicChats.length === 0 && <p className="text-[#8e9297] text-sm text-center mt-8">Нет доступных групп</p>}
          {publicChats.map((c) => {
            const isMember = c.isMember ?? chats.some((ch) => ch.id === c.id);
            return (
              <div key={c.id} className="bg-[#2b2d31] rounded-xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}>
                  <Icon name={c.isChannel ? "Radio" : "Users"} size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm truncate">{c.name}</div>
                  <div className="text-[#8e9297] text-xs">{c.isChannel ? "Канал" : "Группа"} · {(c as { membersCount?: number }).membersCount || 0} участников</div>
                  {c.description && <div className="text-[#8e9297] text-xs truncate">{c.description}</div>}
                </div>
                <button
                  onClick={() => isMember ? (setOpenChatId(c.id), setModal(null)) : joinChat(c.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0"
                  style={{ background: isMember ? "#383a40" : WAVE_ACCENT }}
                >
                  {isMember ? "Открыть" : "Вступить"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OPEN CHAT
  // ─────────────────────────────────────────────────────────────────────────
  if (openChatId) {
    const chat = chats.find((c) => c.id === openChatId);
    const chatName = chat?.type === "direct" ? chat.partner?.name : chat?.name;
    const chatPartnerUser = chat?.type === "direct" ? chat.partner : null;

    return (
      <div className="min-h-screen bg-[#313338] flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <div className="h-14 bg-[#2b2d31] border-b border-[#1e1f22] flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={() => { setOpenChatId(null); setChatMessages([]); lastMsgTsRef.current = 0; }} className="text-[#8e9297] hover:text-white"><Icon name="ArrowLeft" size={20} /></button>
          <button onClick={() => { if (chatPartnerUser) { setProfileUserId(chatPartnerUser.id); setModal("profile"); } }} className="flex items-center gap-3 flex-1 min-w-0">
            {chatPartnerUser ? <AvatarComp user={chatPartnerUser} size={36} showOnline /> : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}>
                <Icon name={chat?.isChannel ? "Radio" : "Users"} size={18} />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-white font-semibold text-sm truncate">
                {chatPartnerUser?.rainbowNick ? <RainbowText text={chatName || ""} /> : chatName || "Чат"}
              </div>
              <div className={`text-xs ${chatPartnerUser?.online ? "text-[#3ba55c]" : "text-[#8e9297]"}`}>
                {chat?.type === "direct" ? (chatPartnerUser?.online ? "онлайн" : "был(а) недавно") : `${chat?.members?.length || 0} участников`}
              </div>
            </div>
          </button>
          <button onClick={() => { setProfileUserId(currentUser.id); setModal("profile"); }}>
            <AvatarComp user={currentUser} size={32} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatMessages.length === 0 && <div className="text-center text-[#8e9297] text-sm mt-8">Начните общение! 👋</div>}
          {chatMessages.map((msg) => {
            const isMe = msg.fromId === currentUser.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2`}>
                {!isMe && (
                  <button onClick={() => { setProfileUserId(msg.fromId); setModal("profile"); }}>
                    <AvatarComp user={{ name: msg.fromName || "?", avatar: msg.fromAvatar || null }} size={32} />
                  </button>
                )}
                <div className="max-w-[70%]">
                  {!isMe && chat?.type !== "direct" && <p className="text-xs text-[#6C63FF] mb-1 font-semibold">{msg.fromRainbow ? <RainbowText text={msg.fromName || ""} /> : msg.fromName}</p>}
                  <div className={`rounded-2xl px-4 py-2 ${isMe ? "rounded-br-sm" : "rounded-bl-sm"}`} style={{ background: isMe ? "linear-gradient(135deg,#6C63FF,#a855f7)" : "#383a40" }}>
                    {msg.image && <img src={msg.image} alt="" className="rounded-xl mb-2 max-w-full" style={{ maxHeight: 200 }} />}
                    {msg.audio && <audio controls src={msg.audio} className="max-w-full" />}
                    {msg.text && <p className="text-white text-sm">{msg.text}</p>}
                    <p className="text-white/50 text-xs mt-1 text-right">{formatTime(msg.timestamp)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {chatImage && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <img src={chatImage} alt="" className="h-16 rounded-xl" />
            <button onClick={() => setChatImage(null)} className="text-[#ed4245]"><Icon name="X" size={16} /></button>
          </div>
        )}

        {/* Input */}
        {(!chat?.isChannel || chat?.ownerId === currentUser.id) && (
          <div className="p-4 bg-[#2b2d31] border-t border-[#1e1f22] flex items-center gap-2">
            <button onClick={() => chatFileRef.current?.click()} className="text-[#8e9297] hover:text-white flex-shrink-0"><Icon name="Image" size={20} /></button>
            <input ref={chatFileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setChatImage(await readFileAsBase64(f)); }} />
            <input className="flex-1 bg-[#383a40] text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66]" placeholder="Написать сообщение..." value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
            <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`flex-shrink-0 transition-colors ${recording ? "text-[#ed4245]" : "text-[#8e9297] hover:text-white"}`}><Icon name="Mic" size={20} /></button>
            <button onClick={sendMessage} className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: WAVE_ACCENT }}><Icon name="Send" size={18} /></button>
          </div>
        )}
        {chat?.isChannel && chat?.ownerId !== currentUser.id && (
          <div className="p-3 bg-[#2b2d31] border-t border-[#1e1f22] text-center text-[#8e9297] text-xs">Только администратор может писать в этот канал</div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN APP TABS
  // ─────────────────────────────────────────────────────────────────────────
  const renderTab = () => {
    if (activeTab === "chats") {
      return (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 pb-2 flex items-center justify-between">
            <h2 className="text-white text-xl font-bold">Сообщения</h2>
            <div className="flex gap-2">
              <button onClick={() => { setNewGroupIsChannel(false); setModal("createGroup"); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8e9297] hover:text-white hover:bg-[#383a40]" title="Новая группа"><Icon name="Users" size={18} /></button>
              <button onClick={() => { setNewGroupIsChannel(true); setModal("createChannel"); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8e9297] hover:text-white hover:bg-[#383a40]" title="Новый канал"><Icon name="Radio" size={18} /></button>
              <button onClick={loadPublicChats} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8e9297] hover:text-white hover:bg-[#383a40]" title="Найти группы"><Icon name="Search" size={18} /></button>
            </div>
          </div>
          {chats.length === 0 && <div className="text-center text-[#8e9297] text-sm mt-16 px-6">Нет чатов. Найдите пользователей в контактах!</div>}
          {chats.map((chat) => {
            const name = chat.type === "direct" ? chat.partner?.name : chat.name;
            const avatarUser = chat.type === "direct" ? { name: name || "?", avatar: chat.partner?.avatar || null, online: chat.partner?.online } : { name: name || "Группа", avatar: chat.avatar };
            const lm = chat.lastMessage;
            return (
              <button key={chat.id} onClick={() => { setOpenChatId(chat.id); lastMsgTsRef.current = 0; }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#383a40] transition-colors">
                {chat.type === "direct" ? <AvatarComp user={avatarUser} size={48} showOnline /> : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}>
                    <Icon name={chat.isChannel ? "Radio" : "Users"} size={22} />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold text-sm truncate">
                      {chat.type === "direct" && chat.partner?.rainbowNick ? <RainbowText text={name || ""} /> : name || "Чат"}
                    </span>
                    {lm && <span className="text-[#8e9297] text-xs flex-shrink-0 ml-2">{formatTime(lm.timestamp)}</span>}
                  </div>
                  <p className="text-[#8e9297] text-xs truncate mt-0.5">
                    {lm ? (lm.audio ? "🎤 Голосовое" : lm.image ? "📷 Фото" : lm.text) : (chat.type !== "direct" ? chat.description || "Нет сообщений" : "Нет сообщений")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    if (activeTab === "contacts") {
      const sorted = [...users].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
      return (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 pb-2"><h2 className="text-white text-xl font-bold mb-4">Контакты</h2></div>
          {sorted.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <AvatarComp user={u} size={48} showOnline />
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm">{u.rainbowNick ? <RainbowText text={u.name} /> : u.name}</div>
                <div className="text-[#8e9297] text-xs">{u.username}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setProfileUserId(u.id); setModal("profile"); }} className="text-[#8e9297] hover:text-white"><Icon name="User" size={18} /></button>
                <button onClick={() => openDirectChat(u.id)} className="text-[#6C63FF] hover:text-[#a855f7]"><Icon name="MessageCircle" size={20} /></button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === "ai") {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}>
              <Icon name="Bot" size={40} />
            </div>
            <h2 className="text-white text-xl font-bold mb-3">ИИ-помощник</h2>
            <p className="text-[#8e9297] text-sm leading-relaxed max-w-xs">Наш ИИ-помощник уехал на Бали и пока не может работать, но мы надеемся, что через неделю он вернётся 🌴</p>
          </div>
        </div>
      );
    }

    if (activeTab === "admin" && currentUser.isAdmin) {
      const filtered = users.filter((u) => u.id !== currentUser.id && (u.name.toLowerCase().includes(adminSearch.toLowerCase()) || u.username.toLowerCase().includes(adminSearch.toLowerCase())));
      return (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-white text-xl font-bold mb-4">Админ-панель</h2>
            <input className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66] mb-4" placeholder="Поиск..." value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} />
            {filtered.map((u) => {
              const userChats = chats.filter((c) => c.type === "direct" && c.members.some((m) => m.id === u.id));
              return (
                <div key={u.id} className="bg-[#383a40] rounded-xl p-4 mb-3">
                  <div className="flex items-center gap-3 mb-3">
                    <AvatarComp user={u} size={40} showOnline />
                    <div>
                      <div className="text-white font-semibold text-sm">{u.rainbowNick ? <RainbowText text={u.name} /> : u.name}</div>
                      <div className="text-[#8e9297] text-xs">{u.username}</div>
                      {u.banned && <span className="text-[#ed4245] text-xs font-semibold">🚫 Заблокирован</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button onClick={() => adminBan(u.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${u.banned ? "bg-[#3ba55c]" : "bg-[#ed4245]"}`}>{u.banned ? "Разбанить" : "Забанить"}</button>
                    <button onClick={() => adminRainbow(u.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: "linear-gradient(90deg,#ff0000,#ff7700,#ffff00,#00ff00,#0000ff,#8b00ff)" }}>{u.rainbowNick ? "Убрать радугу" : "Дать радугу"}</button>
                    <button onClick={() => setAdminBadgeUserId(adminBadgeUserId === u.id ? null : u.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#faa61a]">Бейджи</button>
                    {userChats.length > 0 && <button onClick={() => adminViewChat(userChats[0].id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#6C63FF]">{adminViewChatId === userChats[0].id ? "Скрыть" : "Чат"}</button>}
                  </div>
                  {adminBadgeUserId === u.id && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {allBadges.map((badge) => {
                        const has = u.badges?.find((b) => b.id === badge.id);
                        return <button key={badge.id} onClick={() => adminGiveBadge(u.id, badge.id)} className="px-2 py-1 rounded-full text-xs font-semibold text-white transition-all" style={{ background: badge.color, opacity: has ? 1 : 0.4 }}>{has ? "✓ " : "+ "}{badge.label}</button>;
                      })}
                    </div>
                  )}
                  {adminViewChatId === userChats[0]?.id && (
                    <div className="bg-[#2b2d31] rounded-xl p-3 max-h-48 overflow-y-auto space-y-2">
                      {adminChatMsgs.length === 0 && <p className="text-[#8e9297] text-xs">Нет сообщений</p>}
                      {adminChatMsgs.map((m) => <div key={m.id} className="text-xs"><span className="text-[#6C63FF] font-semibold">{m.fromName || m.fromId}: </span><span className="text-[#dcddde]">{m.audio ? "🎤" : m.image ? "📷" : m.text}</span></div>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeTab === "settings") {
      return (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-white text-xl font-bold mb-6">Настройки</h2>
            <div className="flex justify-center mb-6">
              <button onClick={() => settingsAvatarRef.current?.click()} className="relative group">
                <AvatarComp user={{ name: currentUser.name, avatar: settingsAvatar }} size={80} />
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="Camera" size={24} /></div>
                <input ref={settingsAvatarRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setSettingsAvatar(await readFileAsBase64(f)); }} />
              </button>
            </div>
            <div className="space-y-3 mb-6">
              <div><label className="text-[#8e9297] text-xs font-semibold uppercase tracking-wider mb-1 block">Имя</label><input className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF]" value={settingsName} onChange={(e) => setSettingsName(e.target.value)} /></div>
              <div><label className="text-[#8e9297] text-xs font-semibold uppercase tracking-wider mb-1 block">Юзернейм (не изменяется)</label><input disabled className="w-full bg-[#1e1f22] text-[#5c5f66] rounded-xl px-4 py-3 text-sm cursor-not-allowed" value={currentUser.username} /></div>
              <div><label className="text-[#8e9297] text-xs font-semibold uppercase tracking-wider mb-1 block">О себе</label><textarea className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] resize-none" rows={3} value={settingsBio} onChange={(e) => setSettingsBio(e.target.value)} placeholder="Расскажите о себе..." /></div>
            </div>
            <button onClick={saveSettings} className="w-full py-3 rounded-xl text-white font-semibold mb-3 transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}>
              {settingsSaved ? "✓ Сохранено!" : "Сохранить"}
            </button>
            <button onClick={handleLogout} className="w-full py-3 rounded-xl text-[#ed4245] font-semibold border border-[#ed4245]/30 hover:bg-[#ed4245]/10 transition-all">Выйти из аккаунта</button>
          </div>
        </div>
      );
    }

    return null;
  };

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: "contacts", icon: "Users", label: "Контакты" },
    { id: "chats", icon: "MessageCircle", label: "Чаты" },
    { id: "ai", icon: "Bot", label: "ИИ" },
    ...(currentUser.isAdmin ? [{ id: "admin" as Tab, icon: "Shield", label: "Админ" }] : []),
    { id: "settings", icon: "Settings", label: "Настройки" },
  ];

  return (
    <div className="min-h-screen bg-[#313338] flex flex-col max-w-lg mx-auto">
      <div className="h-14 bg-[#2b2d31] border-b border-[#1e1f22] flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}><span className="text-white text-xs font-black">19</span></div>
          <span className="text-white font-bold text-lg">19 wave</span>
        </div>
        <button onClick={() => { setProfileUserId(currentUser.id); setModal("profile"); }}>
          <AvatarComp user={currentUser} size={36} showOnline />
        </button>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">{renderTab()}</div>
      <div className="bg-[#2b2d31] border-t border-[#1e1f22] flex items-center justify-around px-2 py-2 flex-shrink-0">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${activeTab === tab.id ? "text-white" : "text-[#8e9297] hover:text-[#dcddde]"}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === tab.id ? "bg-[#6C63FF]" : "hover:bg-[#383a40]"}`}>
              <Icon name={tab.icon} fallback="Circle" size={20} />
            </div>
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Index;
