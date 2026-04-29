import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

// ─── Types ───────────────────────────────────────────────────────────────────
type Badge = { id: string; label: string; color: string };
type User = {
  id: string;
  name: string;
  username: string;
  phone: string;
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
  toId: string;
  text: string;
  image?: string;
  audio?: string;
  timestamp: number;
};
type Tab = "chats" | "contacts" | "ai" | "admin" | "settings";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ADMIN_USERNAME = "@admin";
const WAVE_ACCENT = "#6C63FF";

const availableBadges: Badge[] = [
  { id: "verified", label: "✓ Верифицирован", color: "#3ba55c" },
  { id: "og", label: "⭐ OG", color: "#faa61a" },
  { id: "dev", label: "🛠 Разработчик", color: "#5865f2" },
  { id: "top", label: "🔥 Топ пользователь", color: "#ed4245" },
  { id: "wave", label: "🌊 19 wave", color: "#6C63FF" },
];

const generateId = () => Math.random().toString(36).slice(2);

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

const getInitials = (name: string) => name.charAt(0).toUpperCase();

const RainbowText = ({ text }: { text: string }) => (
  <span
    style={{
      background: "linear-gradient(90deg,#ff0000,#ff7700,#ffff00,#00ff00,#0000ff,#8b00ff)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      fontWeight: 700,
    }}
  >
    {text}
  </span>
);

// ─── Demo seed data ──────────────────────────────────────────────────────────
const seedUsers: User[] = [
  {
    id: "u1",
    name: "Алекс",
    username: "@alex",
    phone: "+79001234567",
    avatar: null,
    bio: "Люблю музыку и волны 🌊",
    online: true,
    isAdmin: false,
    rainbowNick: false,
    badges: [availableBadges[1]],
    banned: false,
  },
  {
    id: "u2",
    name: "Маша",
    username: "@masha",
    phone: "+79007654321",
    avatar: null,
    bio: "Дизайнер интерфейсов",
    online: false,
    isAdmin: false,
    rainbowNick: true,
    badges: [availableBadges[0], availableBadges[2]],
    banned: false,
  },
  {
    id: "u3",
    name: "Даня",
    username: "@danya",
    phone: "+79001112233",
    avatar: null,
    bio: "Frontend dev 🚀",
    online: true,
    isAdmin: false,
    rainbowNick: false,
    badges: [availableBadges[4]],
    banned: false,
  },
];

const seedMessages: Message[] = [
  { id: "m1", fromId: "u1", toId: "ADMIN", text: "Привет! Как дела?", timestamp: Date.now() - 3600000 },
  { id: "m2", fromId: "ADMIN", toId: "u1", text: "Всё отлично, спасибо!", timestamp: Date.now() - 3500000 },
  { id: "m3", fromId: "u2", toId: "ADMIN", text: "Посмотри мой дизайн", timestamp: Date.now() - 1800000 },
  { id: "m4", fromId: "ADMIN", toId: "u2", text: "Выглядит классно!", timestamp: Date.now() - 1700000 },
  { id: "m5", fromId: "u3", toId: "ADMIN", text: "Новая волна 🌊", timestamp: Date.now() - 900000 },
];

// ─── Avatar component ────────────────────────────────────────────────────────
const Avatar = ({
  user,
  size = 40,
  showOnline = false,
}: {
  user: { name: string; avatar: string | null; online?: boolean };
  size?: number;
  showOnline?: boolean;
}) => (
  <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
    {user.avatar ? (
      <img
        src={user.avatar}
        alt={user.name}
        className="rounded-full object-cover w-full h-full"
        style={{ width: size, height: size }}
      />
    ) : (
      <div
        className="rounded-full flex items-center justify-center text-white font-bold"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(135deg,#6C63FF,#a855f7)",
          fontSize: size * 0.4,
        }}
      >
        {getInitials(user.name)}
      </div>
    )}
    {showOnline && user.online !== undefined && (
      <div
        className={`absolute bottom-0 right-0 rounded-full border-2 border-[#1e1f22] ${user.online ? "bg-[#3ba55c]" : "bg-[#80848e]"}`}
        style={{ width: size * 0.28, height: size * 0.28 }}
      />
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════
const Index = () => {
  // ── Auth state ──
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(seedUsers);
  const [messages, setMessages] = useState<Message[]>(seedMessages);

  // ── Register form ──
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAvatar, setRegAvatar] = useState<string | null>(null);
  const [regError, setRegError] = useState("");

  // ── Login form ──
  const [loginPhone, setLoginPhone] = useState("");
  const [loginError, setLoginError] = useState("");

  // ── Main app state ──
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [openChatUserId, setOpenChatUserId] = useState<string | null>(null);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [chatText, setChatText] = useState("");
  const [chatImage, setChatImage] = useState<string | null>(null);

  // ── Settings ──
  const [settingsName, setSettingsName] = useState("");
  const [settingsBio, setSettingsBio] = useState("");
  const [settingsAvatar, setSettingsAvatar] = useState<string | null>(null);

  // ── Admin panel ──
  const [adminSearch, setAdminSearch] = useState("");
  const [adminBadgeUserId, setAdminBadgeUserId] = useState<string | null>(null);
  const [adminViewChatId, setAdminViewChatId] = useState<string | null>(null);

  // ── Recording ──
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const regAvatarRef = useRef<HTMLInputElement>(null);
  const settingsAvatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, openChatUserId]);

  // ── Init settings from currentUser ──
  useEffect(() => {
    if (currentUser) {
      setSettingsName(currentUser.name);
      setSettingsBio(currentUser.bio);
      setSettingsAvatar(currentUser.avatar);
    }
  }, [currentUser]);

  // ─── Auth handlers ────────────────────────────────────────────────────────
  const handleRegister = () => {
    setRegError("");
    if (!regName.trim()) return setRegError("Введите имя");
    if (!regUsername.startsWith("@") || !/^@[a-z]+$/.test(regUsername))
      return setRegError("Юзернейм должен начинаться с @ и содержать только строчные английские буквы");
    if (users.find((u) => u.username === regUsername))
      return setRegError("Этот юзернейм уже занят");
    if (!regPhone.trim()) return setRegError("Введите номер телефона");

    const isAdmin = regUsername === ADMIN_USERNAME;
    const newUser: User = {
      id: generateId(),
      name: regName.trim(),
      username: regUsername,
      phone: regPhone.trim(),
      avatar: regAvatar,
      bio: "",
      online: true,
      isAdmin,
      rainbowNick: false,
      badges: [],
      banned: false,
    };
    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
  };

  const handleLogin = () => {
    setLoginError("");
    const found = users.find((u) => u.phone === loginPhone.trim());
    if (!found) return setLoginError("Пользователь с таким номером не найден");
    if (found.banned) return setLoginError("Ваш аккаунт заблокирован");
    setCurrentUser({ ...found, online: true });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab("chats");
    setOpenChatUserId(null);
  };

  // ─── Image helpers ────────────────────────────────────────────────────────
  const readFile = (file: File, cb: (b64: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => cb(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ─── Chat helpers ─────────────────────────────────────────────────────────
  const getConversation = (userId: string) =>
    messages
      .filter(
        (m) =>
          (m.fromId === currentUser!.id && m.toId === userId) ||
          (m.fromId === userId && m.toId === currentUser!.id)
      )
      .sort((a, b) => a.timestamp - b.timestamp);

  const getLastMessage = (userId: string) => {
    const conv = getConversation(userId);
    return conv[conv.length - 1] ?? null;
  };

  const sendMessage = () => {
    if (!chatText.trim() && !chatImage) return;
    const msg: Message = {
      id: generateId(),
      fromId: currentUser!.id,
      toId: openChatUserId!,
      text: chatText.trim(),
      image: chatImage ?? undefined,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    setChatText("");
    setChatImage(null);
  };

  // ─── Voice recording ──────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const msg: Message = {
          id: generateId(),
          fromId: currentUser!.id,
          toId: openChatUserId!,
          text: "",
          audio: url,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, msg]);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      alert("Нет доступа к микрофону");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  // ─── Settings save ────────────────────────────────────────────────────────
  const saveSettings = () => {
    if (!settingsName.trim()) return;
    const updated: User = {
      ...currentUser!,
      name: settingsName.trim(),
      bio: settingsBio.trim(),
      avatar: settingsAvatar,
    };
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  // ─── Admin actions ────────────────────────────────────────────────────────
  const adminBan = (id: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, banned: !u.banned } : u)));
  };
  const adminRainbow = (id: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, rainbowNick: !u.rainbowNick } : u)));
  };
  const adminGiveBadge = (userId: string, badge: Badge) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              badges: u.badges.find((b) => b.id === badge.id)
                ? u.badges.filter((b) => b.id !== badge.id)
                : [...u.badges, badge],
            }
          : u
      )
    );
  };

  // ─── Profile view ─────────────────────────────────────────────────────────
  const profileUser = viewProfileId ? users.find((u) => u.id === viewProfileId) ?? null : null;

  // ─── Sorted chat list ─────────────────────────────────────────────────────
  const chatList = users
    .filter((u) => u.id !== currentUser?.id)
    .map((u) => ({ user: u, last: getLastMessage(u.id) }))
    .sort((a, b) => (b.last?.timestamp ?? 0) - (a.last?.timestamp ?? 0));

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}
            >
              <span className="text-white text-3xl font-black">19</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">19 wave</h1>
            <p className="text-[#8e9297] mt-1 text-sm">Мессенджер нового поколения</p>
          </div>

          <div className="bg-[#2b2d31] rounded-2xl p-6 shadow-2xl">
            {/* Tabs */}
            <div className="flex bg-[#1e1f22] rounded-xl p-1 mb-6">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setAuthMode(m);
                    setLoginError("");
                    setRegError("");
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    authMode === m ? "bg-[#6C63FF] text-white" : "text-[#8e9297] hover:text-white"
                  }`}
                >
                  {m === "login" ? "Войти" : "Регистрация"}
                </button>
              ))}
            </div>

            {authMode === "register" ? (
              <div className="space-y-4">
                {/* Avatar upload */}
                <div className="flex justify-center">
                  <button
                    onClick={() => regAvatarRef.current?.click()}
                    className="relative group"
                  >
                    {regAvatar ? (
                      <img
                        src={regAvatar}
                        alt="avatar"
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-2 border-dashed border-[#6C63FF] text-[#6C63FF] hover:bg-[#6C63FF]/10 transition-all"
                      >
                        <Icon name="Camera" size={24} />
                        <span className="text-xs mt-1">Фото</span>
                      </div>
                    )}
                    <input
                      ref={regAvatarRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) readFile(f, setRegAvatar);
                      }}
                    />
                  </button>
                </div>
                <input
                  className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66]"
                  placeholder="Ваше имя"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                />
                <input
                  className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66]"
                  placeholder="@username (только строчные англ. буквы)"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                />
                <input
                  className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66]"
                  placeholder="Номер телефона"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                />
                {regError && <p className="text-[#ed4245] text-xs">{regError}</p>}
                <button
                  onClick={handleRegister}
                  className="w-full py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}
                >
                  Создать аккаунт
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66]"
                  placeholder="Номер телефона"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                />
                {loginError && <p className="text-[#ed4245] text-xs">{loginError}</p>}
                <button
                  onClick={handleLogin}
                  className="w-full py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}
                >
                  Войти
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROFILE MODAL
  // ─────────────────────────────────────────────────────────────────────────
  if (profileUser) {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#2b2d31] rounded-2xl overflow-hidden shadow-2xl">
          {/* Banner */}
          <div
            className="h-24 relative"
            style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}
          >
            <button
              onClick={() => setViewProfileId(null)}
              className="absolute top-3 right-3 text-white/70 hover:text-white"
            >
              <Icon name="X" size={20} />
            </button>
            <div className="absolute -bottom-8 left-4">
              <Avatar user={profileUser} size={64} />
            </div>
          </div>
          <div className="pt-12 px-4 pb-4">
            <div className="mb-3">
              {profileUser.rainbowNick ? (
                <RainbowText text={profileUser.name} />
              ) : (
                <span className="text-white text-xl font-bold">{profileUser.name}</span>
              )}
              <p className="text-[#8e9297] text-sm">{profileUser.username}</p>
              {profileUser.bio && (
                <p className="text-[#dcddde] text-sm mt-2">{profileUser.bio}</p>
              )}
            </div>
            {profileUser.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {profileUser.badges.map((b) => (
                  <span
                    key={b.id}
                    className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                    style={{ background: b.color }}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            )}
            {profileUser.id !== currentUser.id && (
              <button
                onClick={() => {
                  setViewProfileId(null);
                  setOpenChatUserId(profileUser.id);
                  setActiveTab("chats");
                }}
                className="mt-4 w-full py-2 rounded-xl text-white text-sm font-semibold"
                style={{ background: WAVE_ACCENT }}
              >
                Написать
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OPEN CHAT
  // ─────────────────────────────────────────────────────────────────────────
  if (openChatUserId) {
    const chatPartner = users.find((u) => u.id === openChatUserId)!;
    const conversation = getConversation(openChatUserId);

    return (
      <div className="min-h-screen bg-[#313338] flex flex-col">
        {/* Header */}
        <div className="h-14 bg-[#2b2d31] border-b border-[#1e1f22] flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setOpenChatUserId(null)}
            className="text-[#8e9297] hover:text-white transition-colors"
          >
            <Icon name="ArrowLeft" size={20} />
          </button>
          <button
            onClick={() => setViewProfileId(chatPartner.id)}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <Avatar user={chatPartner} size={36} showOnline />
            <div className="min-w-0">
              <div className="text-white font-semibold text-sm truncate">
                {chatPartner.rainbowNick ? (
                  <RainbowText text={chatPartner.name} />
                ) : (
                  chatPartner.name
                )}
              </div>
              <div className="text-[#3ba55c] text-xs">
                {chatPartner.online ? "онлайн" : "был(а) недавно"}
              </div>
            </div>
          </button>
          <button
            onClick={() => setViewProfileId(currentUser.id)}
            className="flex-shrink-0"
          >
            <Avatar user={currentUser} size={32} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {conversation.length === 0 && (
            <div className="text-center text-[#8e9297] text-sm mt-8">
              Начните общение! Напишите первое сообщение 👋
            </div>
          )}
          {conversation.map((msg) => {
            const isMe = msg.fromId === currentUser.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2`}>
                {!isMe && (
                  <button onClick={() => setViewProfileId(msg.fromId)}>
                    <Avatar user={chatPartner} size={32} />
                  </button>
                )}
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isMe ? "rounded-br-sm" : "rounded-bl-sm"
                  }`}
                  style={{
                    background: isMe
                      ? "linear-gradient(135deg,#6C63FF,#a855f7)"
                      : "#383a40",
                  }}
                >
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt=""
                      className="rounded-xl mb-2 max-w-full"
                      style={{ maxHeight: 200 }}
                    />
                  )}
                  {msg.audio && (
                    <audio controls src={msg.audio} className="max-w-full" />
                  )}
                  {msg.text && (
                    <p className="text-white text-sm">{msg.text}</p>
                  )}
                  <p className="text-white/50 text-xs mt-1 text-right">
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Image preview */}
        {chatImage && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <img src={chatImage} alt="" className="h-16 rounded-xl" />
            <button onClick={() => setChatImage(null)} className="text-[#ed4245]">
              <Icon name="X" size={16} />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="p-4 bg-[#2b2d31] border-t border-[#1e1f22] flex items-center gap-2">
          <button
            onClick={() => chatFileRef.current?.click()}
            className="text-[#8e9297] hover:text-white transition-colors flex-shrink-0"
          >
            <Icon name="Image" size={20} />
          </button>
          <input
            ref={chatFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readFile(f, setChatImage);
            }}
          />
          <input
            className="flex-1 bg-[#383a40] text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66]"
            placeholder="Написать сообщение..."
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`flex-shrink-0 transition-colors ${recording ? "text-[#ed4245]" : "text-[#8e9297] hover:text-white"}`}
          >
            <Icon name="Mic" size={20} />
          </button>
          <button
            onClick={sendMessage}
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90"
            style={{ background: WAVE_ACCENT }}
          >
            <Icon name="Send" size={18} />
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN APP
  // ─────────────────────────────────────────────────────────────────────────
  const renderTab = () => {
    // ── CHATS ──────────────────────────────────────────────────────────────
    if (activeTab === "chats") {
      return (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 pb-2">
            <h2 className="text-white text-xl font-bold mb-4">Сообщения</h2>
          </div>
          {chatList.length === 0 && (
            <div className="text-center text-[#8e9297] text-sm mt-16 px-6">
              Нет чатов. Найдите пользователей в контактах!
            </div>
          )}
          {chatList.map(({ user, last }) => (
            <button
              key={user.id}
              onClick={() => setOpenChatUserId(user.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#383a40] transition-colors"
            >
              <Avatar user={user} size={48} showOnline />
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold text-sm truncate">
                    {user.rainbowNick ? <RainbowText text={user.name} /> : user.name}
                  </span>
                  {last && (
                    <span className="text-[#8e9297] text-xs flex-shrink-0 ml-2">
                      {formatTime(last.timestamp)}
                    </span>
                  )}
                </div>
                <p className="text-[#8e9297] text-xs truncate mt-0.5">
                  {last
                    ? last.audio
                      ? "🎤 Голосовое"
                      : last.image
                      ? "📷 Фото"
                      : last.text
                    : "Нет сообщений"}
                </p>
              </div>
            </button>
          ))}
        </div>
      );
    }

    // ── CONTACTS ────────────────────────────────────────────────────────────
    if (activeTab === "contacts") {
      const sorted = [...users]
        .filter((u) => u.id !== currentUser.id)
        .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
      return (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 pb-2">
            <h2 className="text-white text-xl font-bold mb-4">Контакты</h2>
          </div>
          {sorted.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar user={u} size={48} showOnline />
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm">
                  {u.rainbowNick ? <RainbowText text={u.name} /> : u.name}
                </div>
                <div className="text-[#8e9297] text-xs">{u.username}</div>
              </div>
              <button
                onClick={() => setOpenChatUserId(u.id)}
                className="text-[#6C63FF] hover:text-[#a855f7] transition-colors"
              >
                <Icon name="MessageCircle" size={20} />
              </button>
            </div>
          ))}
        </div>
      );
    }

    // ── AI ──────────────────────────────────────────────────────────────────
    if (activeTab === "ai") {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6"
              style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}
            >
              <Icon name="Bot" size={40} />
            </div>
            <h2 className="text-white text-xl font-bold mb-3">ИИ-помощник</h2>
            <p className="text-[#8e9297] text-sm leading-relaxed max-w-xs">
              Наш ИИ-помощник уехал на Бали и пока не может работать, но мы надеемся, что через неделю он вернётся 🌴
            </p>
          </div>
        </div>
      );
    }

    // ── ADMIN ────────────────────────────────────────────────────────────────
    if (activeTab === "admin" && currentUser.isAdmin) {
      const filtered = users.filter(
        (u) =>
          u.id !== currentUser.id &&
          (u.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
            u.username.toLowerCase().includes(adminSearch.toLowerCase()))
      );
      return (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-white text-xl font-bold mb-4">Админ-панель</h2>
            <input
              className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] placeholder-[#5c5f66] mb-4"
              placeholder="Поиск пользователей..."
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
            />
            {filtered.map((u) => (
              <div key={u.id} className="bg-[#383a40] rounded-xl p-4 mb-3">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar user={u} size={40} showOnline />
                  <div>
                    <div className="text-white font-semibold text-sm">
                      {u.rainbowNick ? <RainbowText text={u.name} /> : u.name}
                    </div>
                    <div className="text-[#8e9297] text-xs">{u.username}</div>
                    {u.banned && (
                      <span className="text-[#ed4245] text-xs font-semibold">🚫 Заблокирован</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => adminBan(u.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all ${
                      u.banned ? "bg-[#3ba55c]" : "bg-[#ed4245]"
                    }`}
                  >
                    {u.banned ? "Разбанить" : "Забанить"}
                  </button>
                  <button
                    onClick={() => adminRainbow(u.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{
                      background:
                        "linear-gradient(90deg,#ff0000,#ff7700,#ffff00,#00ff00,#0000ff,#8b00ff)",
                    }}
                  >
                    {u.rainbowNick ? "Убрать радугу" : "Дать радугу"}
                  </button>
                  <button
                    onClick={() => setAdminViewChatId(adminViewChatId === u.id ? null : u.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#6C63FF]"
                  >
                    {adminViewChatId === u.id ? "Скрыть чат" : "Смотреть чат"}
                  </button>
                  <button
                    onClick={() =>
                      setAdminBadgeUserId(adminBadgeUserId === u.id ? null : u.id)
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#faa61a]"
                  >
                    Бейджи
                  </button>
                </div>

                {adminBadgeUserId === u.id && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {availableBadges.map((badge) => {
                      const has = u.badges.find((b) => b.id === badge.id);
                      return (
                        <button
                          key={badge.id}
                          onClick={() => adminGiveBadge(u.id, badge)}
                          className="px-2 py-1 rounded-full text-xs font-semibold text-white transition-all"
                          style={{
                            background: badge.color,
                            opacity: has ? 1 : 0.4,
                          }}
                        >
                          {has ? "✓ " : "+ "}
                          {badge.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {adminViewChatId === u.id && (
                  <div className="bg-[#2b2d31] rounded-xl p-3 max-h-48 overflow-y-auto space-y-2">
                    {getConversation(u.id).length === 0 && (
                      <p className="text-[#8e9297] text-xs">Нет сообщений</p>
                    )}
                    {getConversation(u.id).map((m) => (
                      <div key={m.id} className="text-xs">
                        <span className="text-[#6C63FF] font-semibold">
                          {m.fromId === currentUser.id ? "Вы" : u.name}:{" "}
                        </span>
                        <span className="text-[#dcddde]">
                          {m.audio ? "🎤 Голосовое" : m.image ? "📷 Фото" : m.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── SETTINGS ─────────────────────────────────────────────────────────────
    if (activeTab === "settings") {
      return (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-white text-xl font-bold mb-6">Настройки</h2>

            {/* Avatar */}
            <div className="flex justify-center mb-6">
              <button onClick={() => settingsAvatarRef.current?.click()} className="relative group">
                <Avatar
                  user={{ name: currentUser.name, avatar: settingsAvatar }}
                  size={80}
                />
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon name="Camera" size={24} />
                </div>
                <input
                  ref={settingsAvatarRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readFile(f, setSettingsAvatar);
                  }}
                />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-[#8e9297] text-xs font-semibold uppercase tracking-wider mb-1 block">
                  Имя
                </label>
                <input
                  className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF]"
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[#8e9297] text-xs font-semibold uppercase tracking-wider mb-1 block">
                  Юзернейм (не изменяется)
                </label>
                <input
                  disabled
                  className="w-full bg-[#1e1f22] text-[#5c5f66] rounded-xl px-4 py-3 text-sm cursor-not-allowed"
                  value={currentUser.username}
                />
              </div>
              <div>
                <label className="text-[#8e9297] text-xs font-semibold uppercase tracking-wider mb-1 block">
                  О себе
                </label>
                <textarea
                  className="w-full bg-[#1e1f22] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] resize-none"
                  rows={3}
                  value={settingsBio}
                  onChange={(e) => setSettingsBio(e.target.value)}
                  placeholder="Расскажите о себе..."
                />
              </div>
            </div>

            <button
              onClick={saveSettings}
              className="w-full py-3 rounded-xl text-white font-semibold mb-3 transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}
            >
              Сохранить
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-xl text-[#ed4245] font-semibold border border-[#ed4245]/30 hover:bg-[#ed4245]/10 transition-all"
            >
              Выйти из аккаунта
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // BOTTOM NAV + LAYOUT
  // ─────────────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; icon: string; label: string; adminOnly?: boolean }[] = [
    { id: "contacts", icon: "Users", label: "Контакты" },
    { id: "chats", icon: "MessageCircle", label: "Чаты" },
    { id: "ai", icon: "Bot", label: "ИИ" },
    ...(currentUser.isAdmin
      ? [{ id: "admin" as Tab, icon: "Shield", label: "Админ", adminOnly: true }]
      : []),
    { id: "settings", icon: "Settings", label: "Настройки" },
  ];

  return (
    <div className="min-h-screen bg-[#313338] flex flex-col max-w-lg mx-auto relative">
      {/* Header */}
      <div className="h-14 bg-[#2b2d31] border-b border-[#1e1f22] flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#6C63FF,#a855f7)" }}
          >
            <span className="text-white text-xs font-black">19</span>
          </div>
          <span className="text-white font-bold text-lg">19 wave</span>
        </div>
        <button onClick={() => setViewProfileId(currentUser.id)}>
          <Avatar user={currentUser} size={36} showOnline />
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden">{renderTab()}</div>

      {/* Bottom navigation */}
      <div className="bg-[#2b2d31] border-t border-[#1e1f22] flex items-center justify-around px-2 py-2 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
              activeTab === tab.id
                ? "text-white"
                : "text-[#8e9297] hover:text-[#dcddde]"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                activeTab === tab.id ? "bg-[#6C63FF]" : "hover:bg-[#383a40]"
              }`}
            >
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