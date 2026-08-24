import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  Ticket, 
  Mail, 
  Phone, 
  ArrowLeft, 
  Download, 
  QrCode, 
  Calendar, 
  MapPin, 
  CheckCircle, 
  Clock, 
  XCircle, 
  LogOut, 
  Search, 
  Sparkles,
  Send,
  ExternalLink,
  ChevronRight,
  X,
  Lock,
  KeyRound,
  User,
  ShieldCheck,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { getFbFirestore } from '../lib/firebase';
import { useApp } from '../contexts/AppContext';
import { Order, Event, UserAccount } from '../types';
import { generateQRCodeBase64, getBase64ImageSafe, downloadTicketPDF } from '../services/pdfService';
import axios from 'axios';

interface CabinetOrder extends Order {
  event?: Event;
}

export default function UserCabinet() {
  const { config, events, privateSettings } = useApp();
  
  // Auth state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [identifierInput, setIdentifierInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regSurname, setRegSurname] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('user_cabinet_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  const [activeIdentifier, setActiveIdentifier] = useState<string | null>(() => {
    return localStorage.getItem('user_cabinet_identifier') || null;
  });
  
  // Views inside logged-in cabinet
  const [activeSection, setActiveSection] = useState<'tickets' | 'profile'>('tickets');
  const [selectedTab, setSelectedTab] = useState<'all' | 'active' | 'past'>('all');

  // Forgot password flow state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'input' | 'code' | 'new_password'>('input');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotTargetEmail, setForgotTargetEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState<string | null>(null);

  // Profile Edit state
  const [profileName, setProfileName] = useState('');
  const [profileSurname, setProfileSurname] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Change Password state inside Profile
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Tickets & UI state
  const [orders, setOrders] = useState<CabinetOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // QR modal state
  const [selectedQrOrder, setSelectedQrOrder] = useState<{ order: CabinetOrder; subIndex: number } | null>(null);
  const [qrBase64, setQrBase64] = useState<string>('');
  
  // PDF download state
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);

  // Email resend state
  const [resendingOrderId, setResendingOrderId] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<{ [orderId: string]: string }>({});

  const normalizePhone = (p: string) => p.replace(/[^\d]/g, '');

  // Populate profile fields when user loads
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || '');
      setProfileSurname(currentUser.surname || '');
      setProfilePhone(currentUser.phone || '');
    }
  }, [currentUser]);

  const fetchOrdersForIdentifier = async (rawId: string) => {
    if (!rawId.trim()) return;
    setLoading(true);
    setError(null);
    const cleaned = rawId.trim();

    try {
      // 1. Try server-side API endpoint for flexible phone/email lookup
      try {
        const apiRes = await axios.post('/api/cabinet/orders', { identifier: cleaned });
        if (apiRes.data && Array.isArray(apiRes.data.orders)) {
          setOrders(apiRes.data.orders);
          setLoading(false);
          return;
        }
      } catch (apiErr) {
        console.warn("Backend cabinet API call failed, falling back to direct Firestore:", apiErr);
      }

      // 2. Direct Firestore query fallback
      const db = getFbFirestore();
      if (!db) {
        throw new Error("База даних тимчасово недоступна");
      }

      const isEmail = cleaned.includes('@');
      let foundOrders: CabinetOrder[] = [];

      if (isEmail) {
        const q = query(collection(db, 'orders'), where('email', '==', cleaned.toLowerCase()));
        const snap = await getDocs(q);
        foundOrders = snap.docs.map(d => ({ id: d.id, ...d.data() } as CabinetOrder));
      } else {
        // Search by phone variations
        const cleanDigits = normalizePhone(cleaned);
        const allOrdersSnap = await getDocs(collection(db, 'orders'));
        foundOrders = allOrdersSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as CabinetOrder))
          .filter(o => {
            if (!o.phone) return false;
            const oDigits = normalizePhone(o.phone);
            return oDigits.includes(cleanDigits) || cleanDigits.includes(oDigits);
          });
      }

      // Enrich with event data
      const enriched = await Promise.all(
        foundOrders.map(async (order) => {
          let event = events.find(e => e.id === order.eventId);
          if (!event) {
            try {
              const eventSnap = await getDoc(doc(db, 'events', order.eventId));
              if (eventSnap.exists()) {
                event = { id: eventSnap.id, ...eventSnap.data() } as Event;
              }
            } catch (e) {
              console.warn("Could not fetch event for order:", order.id);
            }
          }
          return { ...order, event };
        })
      );

      enriched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(enriched);
    } catch (err: any) {
      console.error("Error fetching cabinet orders:", err);
      setError("Не вдалося завантажити квитки. Перевірте з'єднання з інтернетом.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeIdentifier) {
      fetchOrdersForIdentifier(activeIdentifier);
    }
  }, [activeIdentifier]);

  // Handle Login via Password or Temp Password
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifierInput.trim() || !passwordInput.trim()) return;
    setLoading(true);
    setLoginError(null);

    try {
      const res = await axios.post('/api/cabinet/login', {
        identifier: identifierInput.trim(),
        password: passwordInput.trim()
      });

      if (res.data && res.data.success && res.data.user) {
        const user = res.data.user;
        setCurrentUser(user);
        setActiveIdentifier(user.email || identifierInput.trim());
        localStorage.setItem('user_cabinet_profile', JSON.stringify(user));
        localStorage.setItem('user_cabinet_identifier', user.email || identifierInput.trim());
        setPasswordInput('');
      } else {
        setLoginError("Не вдалося увійти. Перевірте логін та пароль.");
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Невірний пароль або логін. Перевірте тимчасовий пароль у листі або зареєструйтесь.";
      setLoginError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim() || !regPassword.trim()) {
      setRegError("Вкажіть email та пароль");
      return;
    }
    if (!regEmail.includes('@')) {
      setRegError("Введіть коректну електронну пошту");
      return;
    }
    if (regPassword.length < 4) {
      setRegError("Пароль повинен бути не менше 4 символів");
      return;
    }
    if (regConfirmPassword && regPassword !== regConfirmPassword) {
      setRegError("Паролі не співпадають");
      return;
    }

    setLoading(true);
    setRegError(null);

    try {
      const res = await axios.post('/api/cabinet/register', {
        email: regEmail.trim(),
        password: regPassword.trim(),
        name: regName.trim(),
        surname: regSurname.trim(),
        phone: regPhone.trim()
      });

      if (res.data && res.data.success && res.data.user) {
        const user = res.data.user;
        setCurrentUser(user);
        setActiveIdentifier(user.email);
        localStorage.setItem('user_cabinet_profile', JSON.stringify(user));
        localStorage.setItem('user_cabinet_identifier', user.email);
        setRegPassword('');
        setRegConfirmPassword('');
      } else {
        setRegError("Помилка при створенні акаунта");
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Не вдалося зареєструватися. Спробуйте ще раз.";
      setRegError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_cabinet_identifier');
    localStorage.removeItem('user_cabinet_profile');
    setActiveIdentifier(null);
    setCurrentUser(null);
    setOrders([]);
    setIdentifierInput('');
    setPasswordInput('');
  };

  // Forgot Password: Request 6-digit verification code
  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) return;
    setForgotLoading(true);
    setForgotError(null);

    try {
      const res = await axios.post('/api/cabinet/forgot-password', {
        identifier: forgotIdentifier.trim()
      });

      if (res.data && res.data.success) {
        setForgotTargetEmail(res.data.email);
        setForgotSuccessMessage(res.data.message || 'Код надіслано на вашу пошту!');
        setForgotStep('code');
      }
    } catch (err: any) {
      setForgotError(err.response?.data?.error || "Не вдалося надіслати код. Перевірте правильність введених даних.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Forgot Password: Verify Code
  const handleVerifyResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotCode.trim()) return;
    setForgotLoading(true);
    setForgotError(null);

    try {
      const res = await axios.post('/api/cabinet/verify-reset-code', {
        email: forgotTargetEmail,
        code: forgotCode.trim()
      });

      if (res.data && res.data.valid) {
        setForgotStep('new_password');
      }
    } catch (err: any) {
      setForgotError(err.response?.data?.error || "Невірний або застарілий код підтвердження.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Forgot Password: Set New Password
  const handleCompleteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotNewPassword.trim()) return;
    if (forgotNewPassword.length < 4) {
      setForgotError("Пароль повинен бути не менше 4 символів");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);

    try {
      const res = await axios.post('/api/cabinet/reset-password', {
        email: forgotTargetEmail,
        code: forgotCode.trim(),
        newPassword: forgotNewPassword.trim()
      });

      if (res.data && res.data.success) {
        const user = res.data.user;
        setCurrentUser(user);
        setActiveIdentifier(user.email);
        localStorage.setItem('user_cabinet_profile', JSON.stringify(user));
        localStorage.setItem('user_cabinet_identifier', user.email);
        setForgotModalOpen(false);
        // Reset modal fields
        setForgotStep('input');
        setForgotCode('');
        setForgotNewPassword('');
        setForgotIdentifier('');
      }
    } catch (err: any) {
      setForgotError(err.response?.data?.error || "Не вдалося встановити новий пароль.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Profile: Update Name, Surname, Phone
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.email) return;
    setProfileSaving(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    try {
      const res = await axios.post('/api/cabinet/update-profile', {
        email: currentUser.email,
        name: profileName,
        surname: profileSurname,
        phone: profilePhone
      });

      if (res.data && res.data.success) {
        const updated = res.data.user;
        setCurrentUser(updated);
        localStorage.setItem('user_cabinet_profile', JSON.stringify(updated));
        setProfileSuccessMsg("Дані профілю успішно оновлено!");
        setTimeout(() => setProfileSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setProfileErrorMsg(err.response?.data?.error || "Помилка при оновленні профілю");
    } finally {
      setProfileSaving(false);
    }
  };

  // Profile: Change Password
  const handleChangePasswordInProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.email) return;
    if (newPassword.length < 4) {
      setPasswordErrorMsg("Новий пароль повинен бути щонайменше 4 символи");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg("Паролі не співпадають");
      return;
    }

    setPasswordSaving(true);
    setPasswordSuccessMsg(null);
    setPasswordErrorMsg(null);

    try {
      const res = await axios.post('/api/cabinet/change-password', {
        email: currentUser.email,
        oldPassword: oldPassword.trim(),
        newPassword: newPassword.trim()
      });

      if (res.data && res.data.success) {
        const updated = res.data.user;
        setCurrentUser(updated);
        localStorage.setItem('user_cabinet_profile', JSON.stringify(updated));
        setPasswordSuccessMsg("Пароль успішно змінено! Тимчасовий пароль анульовано.");
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccessMsg(null), 5000);
      }
    } catch (err: any) {
      setPasswordErrorMsg(err.response?.data?.error || "Не вдалося змінити пароль. Перевірте поточний пароль.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleOpenQr = async (order: CabinetOrder, subIndex: number) => {
    setSelectedQrOrder({ order, subIndex });
    const qrData = `${order.id}:${subIndex + 1}`;
    const base64 = await generateQRCodeBase64(qrData);
    setQrBase64(base64);
  };

  const handleDownloadPdf = async (order: CabinetOrder) => {
    if (downloadingOrderId) return;
    setDownloadingOrderId(order.id);

    try {
      const event: Event = order.event || {
        id: order.eventId,
        title: 'Подія SKY PARTY',
        description: '',
        date: new Date().toISOString(),
        location: 'Головний зал',
        price: String(order.price),
        vipPrice: String(order.price),
        imageUrl: '',
        ticketLink: '',
        isActive: true,
        createdAt: Date.now()
      };

      let eventBase64Img = '';
      if (event.imageUrl) {
        eventBase64Img = await getBase64ImageSafe(event.imageUrl);
      }

      const qrCount = order.quantity || 1;
      const qrsBase64: string[] = [];
      for (let i = 0; i < qrCount; i++) {
        const qr = await generateQRCodeBase64(`${order.id}:${i + 1}`);
        qrsBase64.push(qr);
      }

      const tempDiv = document.createElement('div');
      tempDiv.id = `temp-cabinet-ticket-${order.id}`;
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '0';
      tempDiv.style.top = '0';
      tempDiv.style.zIndex = '-9999';
      tempDiv.style.pointerEvents = 'none';
      tempDiv.style.width = '600px';

      const tBg = config?.ticketBgColor || '#000000';
      const tText = config?.ticketTextColor || '#ffffff';
      const tAccent = config?.ticketAccentColor || '#a855f7';
      const tBorder = config?.ticketBorderColor || '#27272a';
      const tLogo = config?.ticketLogoUrl || config?.logoUrl || '';
      const tMsg = config?.ticketMessage || '';

      tempDiv.innerHTML = `
        <div style="font-family: sans-serif; background: ${tBg}; color: ${tText}; padding: 40px; text-align: center; border: 2px solid ${tBorder}; border-radius: 40px; width: 600px; box-sizing: border-box;">
          ${tLogo ? `<img src="${tLogo}" style="max-height: 60px; object-fit: contain; margin: 0 auto 20px auto; display: block;" />` : ''}
          ${eventBase64Img ? `<img src="${eventBase64Img}" style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 20px; margin-bottom: 30px;" />` : ''}
          <h1 style="font-size: 32px; margin: 0 0 10px 0; font-weight: 900; text-transform: uppercase; color: ${tText};">${event.title}</h1>
          <p style="font-size: 18px; color: ${tAccent}; margin-bottom: 30px; font-weight: bold; text-transform: uppercase;">
            ${new Date(event.date).toLocaleString('uk-UA', { 
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
            })} | ${event.location}
          </p>
          <div style="background: rgba(255, 255, 255, 0.05); padding: 30px; border-radius: 24px; margin-bottom: 30px; text-align: left; border: 1px solid ${tBorder};">
            <div style="margin-bottom: 20px;">
              <p style="font-size: 10px; color: ${tText}80; margin: 0; text-transform: uppercase;">ВЛАСНИК</p>
              <p style="font-size: 24px; font-weight: 900; margin: 5px 0; color: ${tText};">${order.name} ${order.surname}</p>
            </div>
            <div>
              <p style="font-size: 10px; color: ${tText}80; margin: 0; text-transform: uppercase;">ТИП КВИТКА</p>
              <p style="font-size: 20px; font-weight: 900; margin: 5px 0; color: ${tAccent};">${(order.ticketType || 'standard').toUpperCase()}</p>
            </div>
          </div>
          ${qrsBase64.map((qr, i) => `
            <div style="background: rgba(255, 255, 255, 0.05); padding: 25px; border-radius: 24px; margin-bottom: 20px; border: 1px solid ${tBorder}; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <p style="font-size: 12px; font-weight: bold; margin: 0 0 15px 0; color: ${tAccent}; text-transform: uppercase;">КВИТОК ${i + 1} З ${qrCount}</p>
              <div style="background: #ffffff; padding: 15px; border-radius: 16px; display: inline-block;">
                <img src="${qr}" style="width: 180px; height: 180px; display: block;" />
              </div>
              <p style="font-family: monospace; font-size: 14px; font-weight: bold; margin: 15px 0 0 0; color: ${tAccent};">ID: ${order.id}-${i + 1}</p>
            </div>
          `).join('')}
          ${tMsg ? `<p style="font-size: 12px; font-weight: bold; color: ${tText}; max-width: 80%; margin: 20px auto 0 auto; line-height: 1.4;">${tMsg}</p>` : ''}
          <p style="font-size: 11px; color: ${tText}80; margin-top: 20px;">SKY PARTY</p>
        </div>
      `;
      document.body.appendChild(tempDiv);
      await downloadTicketPDF(`temp-cabinet-ticket-${order.id}`, order.id);
      document.body.removeChild(tempDiv);
    } catch (err) {
      console.error("PDF download error:", err);
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const handleResendEmail = async (order: CabinetOrder) => {
    if (!order.email || resendingOrderId) return;
    setResendingOrderId(order.id);
    setResendStatus(prev => ({ ...prev, [order.id]: 'Надсилаємо...' }));

    try {
      const { sendTicketEmail } = await import('../services/emailService');
      const event: Event = order.event || {
        id: order.eventId,
        title: 'Подія SKY PARTY',
        description: '',
        date: new Date().toISOString(),
        location: 'Головний зал',
        price: String(order.price),
        vipPrice: String(order.price),
        imageUrl: '',
        ticketLink: '',
        isActive: true,
        createdAt: Date.now()
      };

      await sendTicketEmail(
        order.id,
        order.email,
        order.name,
        order.surname,
        event,
        order.ticketType,
        privateSettings,
        undefined,
        order.quantity,
        config,
        order.phone
      );

      setResendStatus(prev => ({ ...prev, [order.id]: '✓ Надіслано!' }));
      setTimeout(() => {
        setResendStatus(prev => {
          const next = { ...prev };
          delete next[order.id];
          return next;
        });
      }, 4000);
    } catch (err: any) {
      console.error("Resend email error:", err);
      setResendStatus(prev => ({ ...prev, [order.id]: '⚠ Помилка відправки' }));
    } finally {
      setResendingOrderId(null);
    }
  };

  const isEventPast = (order: CabinetOrder) => {
    if (!order.event?.date) return false;
    const eventTime = new Date(order.event.date).getTime();
    return eventTime < Date.now() - 24 * 3600 * 1000;
  };

  const filteredOrders = orders.filter(order => {
    if (selectedTab === 'all') return true;
    const past = isEventPast(order);
    if (selectedTab === 'active') return !past;
    if (selectedTab === 'past') return past;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col selection:bg-purple-500/30">
      {/* Header */}
      <header className="h-16 px-4 sm:px-8 border-b border-white/10 bg-black/60 backdrop-blur-xl sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/" 
            className="p-2 rounded-full border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <ArrowLeft size={16} /> На головну
          </Link>
          <span className="font-black text-sm uppercase tracking-[0.2em] text-white hidden sm:inline">
            Особистий кабінет
          </span>
        </div>

        {activeIdentifier && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 py-1.5 px-3 rounded-full text-xs font-mono text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {currentUser?.name ? `${currentUser.name} (${activeIdentifier})` : activeIdentifier}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 text-zinc-400 hover:text-red-400 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
              title="Вийти з кабінету"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline font-bold">Вийти</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10">
        {!activeIdentifier ? (
          /* Login / Register Card */
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto my-8 bg-zinc-900/70 border border-white/10 p-6 sm:p-10 rounded-[36px] shadow-2xl backdrop-blur-md text-center"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-5 text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
              <Ticket size={32} />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-2">
              Особистий кабінет
            </h1>

            {/* Auth Mode Toggle */}
            <div className="flex items-center p-1 bg-black/50 border border-white/10 rounded-2xl mb-6 mt-4">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setLoginError(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Вхід
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setRegError(null);
                  if (identifierInput.includes('@') && !regEmail) {
                    setRegEmail(identifierInput);
                  }
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Реєстрація
              </button>
            </div>

            {authMode === 'login' ? (
              /* LOGIN FORM */
              <>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-6">
                  Увійдіть за допомогою вашого <b>Email або телефону</b> та <b>паролю</b> (тимчасовий пароль надіслано в листі разом із квитком).
                </p>

                {loginError && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs text-left leading-relaxed space-y-2">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </div>
                    {loginError.includes('не знайдено') && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('register');
                          if (identifierInput.includes('@')) setRegEmail(identifierInput);
                        }}
                        className="mt-1 text-xs text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer"
                      >
                        Зареєструвати новий акаунт зараз →
                      </button>
                    )}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4 text-left">
                  {/* Identifier Input */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                      Email або телефон
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={identifierInput}
                        onChange={(e) => setIdentifierInput(e.target.value)}
                        placeholder="name@email.com або +380..."
                        className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-mono text-white placeholder-zinc-500 outline-none transition-all"
                      />
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                        {identifierInput.includes('@') ? <Mail size={18} /> : <Phone size={18} />}
                      </div>
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 ml-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Пароль
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotIdentifier(identifierInput);
                          setForgotError(null);
                          setForgotStep('input');
                          setForgotModalOpen(true);
                        }}
                        className="text-[11px] text-purple-400 hover:text-purple-300 font-bold transition-colors cursor-pointer"
                      >
                        Забули пароль?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Введіть пароль з листа або ваш власний"
                        className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3.5 pl-11 pr-11 text-sm font-mono text-white placeholder-zinc-500 outline-none transition-all"
                      />
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                        <Lock size={18} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-lg hover:shadow-purple-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                    {loading ? 'Перевірка...' : 'Увійти до кабінету'}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-white/5 text-xs text-zinc-500 flex flex-col gap-2 items-center justify-center">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    <span>Тимчасовий пароль генерується автоматично при першій покупці</span>
                  </div>
                </div>
              </>
            ) : (
              /* REGISTRATION FORM */
              <>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-6">
                  Створіть власний акаунт для швидкого перегляду квитків, збереження контактних даних та безпечного доступу.
                </p>

                {regError && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs text-left leading-relaxed flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-3.5 text-left">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                        Ім'я
                      </label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Олексій"
                        className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3 px-3.5 text-sm text-white placeholder-zinc-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                        Прізвище
                      </label>
                      <input
                        type="text"
                        value={regSurname}
                        onChange={(e) => setRegSurname(e.target.value)}
                        placeholder="Коваленко"
                        className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3 px-3.5 text-sm text-white placeholder-zinc-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                      Email <span className="text-purple-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="alex@gmail.com"
                        className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-mono text-white placeholder-zinc-500 outline-none transition-all"
                      />
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                        <Mail size={18} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                      Телефон (опціонально)
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+380991234567"
                        className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-mono text-white placeholder-zinc-500 outline-none transition-all"
                      />
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                        <Phone size={18} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                      Пароль <span className="text-purple-400">* (мін. 4 симв.)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? "text" : "password"}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Створіть надійний пароль"
                        className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3.5 pl-11 pr-11 text-sm font-mono text-white placeholder-zinc-500 outline-none transition-all"
                      />
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                        <Lock size={18} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                      >
                        {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                      Підтвердження паролю
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? "text" : "password"}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Повторіть пароль"
                        className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-mono text-white placeholder-zinc-500 outline-none transition-all"
                      />
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                        <Lock size={18} />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-lg hover:shadow-purple-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    {loading ? 'Реєстрація...' : 'Створити акаунт'}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        ) : (
          /* Logged-in Cabinet View */
          <div className="space-y-8">
            {/* User Profile Header Card */}
            <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-950 border border-white/10 rounded-[32px] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0">
                  <User size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-400 mb-0.5">
                    <Ticket size={12} /> Особистий кабінет покупця
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
                    {currentUser?.name || currentUser?.surname ? `${currentUser.name || ''} ${currentUser.surname || ''}`.trim() : 'Мій профіль'}
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-400 font-mono flex items-center gap-2 mt-0.5">
                    <span>{currentUser?.email || activeIdentifier}</span>
                    {currentUser?.phone && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <span>{currentUser.phone}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Navigation Tabs between Tickets and Profile Settings */}
              <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10 w-full sm:w-auto">
                <button
                  onClick={() => setActiveSection('tickets')}
                  className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeSection === 'tickets'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Ticket size={14} /> Квитки ({orders.length})
                </button>
                <button
                  onClick={() => setActiveSection('profile')}
                  className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeSection === 'profile'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck size={14} /> Налаштування
                </button>
              </div>
            </div>

            {/* SECTION 1: TICKETS VIEW */}
            {activeSection === 'tickets' && (
              <div className="space-y-6">
                {/* Tickets Subtabs */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4 flex-wrap gap-4">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    <button
                      onClick={() => setSelectedTab('all')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        selectedTab === 'all'
                          ? 'bg-white text-black font-black shadow-md'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      Всі ({orders.length})
                    </button>
                    <button
                      onClick={() => setSelectedTab('active')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        selectedTab === 'active'
                          ? 'bg-purple-600 text-white font-black shadow-md'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      Активні ({orders.filter(o => !isEventPast(o)).length})
                    </button>
                    <button
                      onClick={() => setSelectedTab('past')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        selectedTab === 'past'
                          ? 'bg-zinc-800 text-white font-black shadow-md'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      Минулі ({orders.filter(o => isEventPast(o)).length})
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => activeIdentifier && fetchOrdersForIdentifier(activeIdentifier)}
                      disabled={loading}
                      className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-zinc-300 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                      <span>Оновити</span>
                    </button>
                    <Link
                      to="/"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      Придбати ще
                    </Link>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-mono">
                    {error}
                  </div>
                )}

                {/* Loading State */}
                {loading ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto" />
                    <p className="text-xs uppercase tracking-widest text-zinc-500 font-mono">Завантажуємо ваші квитки...</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  /* Empty State */
                  <div className="py-16 text-center bg-zinc-900/30 border border-white/5 rounded-[32px] p-8 space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-zinc-500">
                      <Ticket size={28} />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-white">
                      Квитків не знайдено
                    </h3>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                      За вашим акаунтом ще немає оформлених квитків або вони були замовлені на інший email.
                    </p>
                    <div className="pt-2 flex justify-center gap-3">
                      <Link
                        to="/"
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Переглянути події
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* Tickets List */
                  <div className="grid gap-6">
                    {filteredOrders.map((order) => {
                      const event = order.event;
                      const isPaid = order.status === 'paid';
                      const isUsed = order.status === 'used' || (order.scannedCount >= (order.quantity || 1));
                      const isCancelled = order.status === 'cancelled';
                      const isPending = order.status === 'pending';

                      return (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-zinc-900/70 border border-white/10 rounded-[32px] overflow-hidden p-6 sm:p-8 hover:border-white/20 transition-all flex flex-col gap-6"
                        >
                          {/* Top Row: Event Info & Status */}
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex gap-4 items-start">
                              {event?.imageUrl && (
                                <img
                                  src={event.imageUrl}
                                  alt={event.title || 'Подія'}
                                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-white/10 shrink-0"
                                />
                              )}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    {order.ticketType === 'vip' ? 'VIP квиток' : (order.ticketType === 'free' ? 'Безкоштовний' : 'Стандарт')}
                                  </span>
                                  <span className="text-[10px] font-mono text-zinc-500">
                                    ID: #{order.id}
                                  </span>
                                </div>

                                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                                  {event?.title || 'Подія SKY PARTY'}
                                </h2>

                                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 font-medium pt-1">
                                  {event?.date && (
                                    <div className="flex items-center gap-1.5">
                                      <Calendar size={14} className="text-purple-400" />
                                      {new Date(event.date).toLocaleString('uk-UA', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                  )}
                                  {event?.location && (
                                    <div className="flex items-center gap-1.5">
                                      <MapPin size={14} className="text-purple-400" />
                                      {event.location}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div className="self-start md:self-auto flex md:flex-col items-end gap-2">
                              {isPaid && !isUsed && (
                                <span className="px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                  <CheckCircle size={14} /> Оплачено
                                </span>
                              )}
                              {isUsed && (
                                <span className="px-3 py-1.5 rounded-xl bg-zinc-800 border border-white/10 text-zinc-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                  <CheckCircle size={14} /> Використано
                                </span>
                              )}
                              {isPending && (
                                <span className="px-3 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                  <Clock size={14} /> Очікує оплати
                                </span>
                              )}
                              {isCancelled && (
                                <span className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                  <XCircle size={14} /> Скасовано
                                </span>
                              )}

                              <span className="text-xs font-bold text-zinc-300">
                                {order.quantity || 1} шт • {order.price} ₴
                              </span>
                            </div>
                          </div>

                          {/* Middle: Interactive QR Codes */}
                          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                              <QrCode size={12} className="text-purple-400" />
                              Електронні QR-квитки для пред'явлення на вході (натисніть для збільшення):
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {Array.from({ length: order.quantity || 1 }).map((_, idx) => {
                                const subTicketId = `${order.id}-${idx + 1}`;
                                const isScanned = order.scannedTickets?.includes(String(idx + 1)) || (order.scannedCount > idx);

                                return (
                                  <div
                                    key={idx}
                                    onClick={() => handleOpenQr(order, idx)}
                                    className="bg-zinc-900/90 hover:bg-zinc-800/90 border border-white/10 hover:border-purple-500/40 p-3 rounded-2xl flex items-center gap-3 transition-all cursor-pointer group"
                                  >
                                    <div className="bg-white p-1.5 rounded-xl shrink-0">
                                      <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${order.id}:${idx + 1}`}
                                        alt={`QR ${idx + 1}`}
                                        className="w-12 h-12"
                                      />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-purple-400 transition-colors">
                                        Квиток {idx + 1}
                                      </p>
                                      <p className="text-xs font-mono font-bold text-white truncate">
                                        {subTicketId}
                                      </p>
                                      <p className="text-[10px] font-medium text-zinc-500 mt-0.5">
                                        {isScanned ? (
                                          <span className="text-green-400 font-bold">✓ Відскановано</span>
                                        ) : (
                                          <span>Готовий до входу</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Bottom Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                            <div className="text-xs text-zinc-500 font-mono">
                              Власник: <span className="text-zinc-300 font-bold">{order.name} {order.surname}</span>
                              {order.email && <span className="ml-2">({order.email})</span>}
                            </div>

                            <div className="flex items-center gap-2">
                              {order.email && (
                                <button
                                  onClick={() => handleResendEmail(order)}
                                  disabled={resendingOrderId === order.id}
                                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <Send size={14} />
                                  {resendStatus[order.id] || 'На пошту'}
                                </button>
                              )}

                              <button
                                onClick={() => handleDownloadPdf(order)}
                                disabled={downloadingOrderId === order.id}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <Download size={14} className={downloadingOrderId === order.id ? "animate-spin" : ""} />
                                {downloadingOrderId === order.id ? 'Генерація...' : 'Завантажити PDF'}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: PROFILE & SECURITY VIEW */}
            {activeSection === 'profile' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Personal Profile Info */}
                <div className="bg-zinc-900/70 border border-white/10 rounded-[32px] p-6 sm:p-8 space-y-6">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <User size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase text-white">
                        Особисті дані
                      </h2>
                      <p className="text-xs text-zinc-400">
                        Прив'язка номеру та контактні дані
                      </p>
                    </div>
                  </div>

                  {profileSuccessMsg && (
                    <div className="p-3.5 bg-green-500/10 border border-green-500/25 rounded-2xl text-green-400 text-xs flex items-center gap-2">
                      <Check size={16} /> {profileSuccessMsg}
                    </div>
                  )}

                  {profileErrorMsg && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-red-400 text-xs flex items-center gap-2">
                      <AlertCircle size={16} /> {profileErrorMsg}
                    </div>
                  )}

                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                        Email (основний логін)
                      </label>
                      <input
                        type="email"
                        disabled
                        value={currentUser?.email || ''}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-sm font-mono text-zinc-400 cursor-not-allowed"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                          Ім'я
                        </label>
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="Ваше ім'я"
                          className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3 px-4 text-sm text-white placeholder-zinc-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                          Прізвище
                        </label>
                        <input
                          type="text"
                          value={profileSurname}
                          onChange={(e) => setProfileSurname(e.target.value)}
                          placeholder="Ваше прізвище"
                          className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3 px-4 text-sm text-white placeholder-zinc-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                        Номер телефону (прив'язка до акаунту)
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          placeholder="+380..."
                          className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3 pl-11 pr-4 text-sm font-mono text-white placeholder-zinc-500 outline-none transition-all"
                        />
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                          <Phone size={16} />
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1.5 ml-1">
                        Ви зможете входити до кабінету за цим номером телефону
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-wider text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {profileSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      {profileSaving ? 'Збереження...' : 'Зберегти зміни'}
                    </button>
                  </form>
                </div>

                {/* Password & Security Management */}
                <div className="bg-zinc-900/70 border border-white/10 rounded-[32px] p-6 sm:p-8 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <KeyRound size={20} />
                      </div>
                      <div>
                        <h2 className="text-lg font-black uppercase text-white">
                          Зміна паролю
                        </h2>
                        <p className="text-xs text-zinc-400">
                          Встановлення постійного паролю
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {currentUser?.hasCustomPassword ? (
                        <span className="px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle size={12} /> Власний пароль
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <Clock size={12} /> Тимчасовий
                        </span>
                      )}
                    </div>
                  </div>

                  {passwordSuccessMsg && (
                    <div className="p-3.5 bg-green-500/10 border border-green-500/25 rounded-2xl text-green-400 text-xs flex items-center gap-2">
                      <Check size={16} /> {passwordSuccessMsg}
                    </div>
                  )}

                  {passwordErrorMsg && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-red-400 text-xs flex items-center gap-2">
                      <AlertCircle size={16} /> {passwordErrorMsg}
                    </div>
                  )}

                  {!currentUser?.hasCustomPassword && (
                    <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-300 text-xs leading-relaxed">
                      💡 <b>Рекомендовано:</b> Встановіть свій постійний пароль. Після встановлення тимчасовий пароль буде анульовано і він більше не буде вказуватися в листах.
                    </div>
                  )}

                  <form onSubmit={handleChangePasswordInProfile} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                        Поточний або тимчасовий пароль
                      </label>
                      <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Введіть поточний пароль"
                        className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3 px-4 text-sm font-mono text-white placeholder-zinc-500 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                        Новий пароль
                      </label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Не менше 4 символів"
                        className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3 px-4 text-sm font-mono text-white placeholder-zinc-500 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                        Підтвердження нового паролю
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Повторіть новий пароль"
                        className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3 px-4 text-sm font-mono text-white placeholder-zinc-500 outline-none transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold uppercase tracking-wider text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {passwordSaving ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                      {passwordSaving ? 'Оновлення...' : 'Зберегти новий пароль'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Forgot Password Modal (Multi-step) */}
      <AnimatePresence>
        {forgotModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setForgotModalOpen(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-white/15 p-8 rounded-[36px] shadow-2xl space-y-6 text-left"
            >
              <button
                onClick={() => setForgotModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="text-center">
                <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-purple-400">
                  <KeyRound size={26} />
                </div>
                <h3 className="text-xl font-black uppercase text-white">
                  Відновлення паролю
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {forgotStep === 'input' && "Введіть email або телефон для отримання 6-значного коду"}
                  {forgotStep === 'code' && "Введіть 6-значний код підтвердження, надісланий на пошту"}
                  {forgotStep === 'new_password' && "Введіть новий пароль для вашого акаунту"}
                </p>
              </div>

              {forgotError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              {/* STEP 1: Enter Identifier */}
              {forgotStep === 'input' && (
                <form onSubmit={handleRequestResetCode} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                      Email або номер телефону
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="name@email.com або +380..."
                      className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3.5 px-4 text-sm font-mono text-white placeholder-zinc-500 outline-none transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                    {forgotLoading ? 'Надсилання коду...' : 'Надіслати код на пошту'}
                  </button>
                </form>
              )}

              {/* STEP 2: Enter Code */}
              {forgotStep === 'code' && (
                <form onSubmit={handleVerifyResetCode} className="space-y-4">
                  {forgotSuccessMessage && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-300 text-xs">
                      {forgotSuccessMessage}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                      6-значний код підтвердження
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value.replace(/[^\d]/g, ''))}
                      placeholder="000000"
                      className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3.5 px-4 text-2xl font-mono text-center tracking-[8px] text-purple-400 placeholder-zinc-600 outline-none transition-all"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep('input')}
                      className="w-1/3 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase tracking-wider text-xs rounded-2xl transition-all cursor-pointer"
                    >
                      Назад
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading || forgotCode.length < 6}
                      className="w-2/3 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-wider text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {forgotLoading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      {forgotLoading ? 'Перевірка...' : 'Підтвердити код'}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Enter New Password */}
              {forgotStep === 'new_password' && (
                <form onSubmit={handleCompleteResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 ml-1">
                      Новий пароль
                    </label>
                    <input
                      type="password"
                      required
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Введіть новий пароль"
                      className="w-full bg-black/60 border border-white/15 focus:border-purple-500 rounded-2xl py-3.5 px-4 text-sm font-mono text-white placeholder-zinc-500 outline-none transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading || forgotNewPassword.length < 4}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold uppercase tracking-widest text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? <RefreshCw size={16} className="animate-spin" /> : <Lock size={16} />}
                    {forgotLoading ? 'Збереження...' : 'Зберегти пароль та увійти'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enlarged QR Code Modal */}
      <AnimatePresence>
        {selectedQrOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedQrOrder(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-white/15 p-8 rounded-[36px] text-center shadow-2xl space-y-6"
            >
              <button
                onClick={() => setSelectedQrOrder(null)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={20} />
              </button>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">
                  QR-код для входу
                </p>
                <h3 className="text-lg font-black uppercase text-white mt-1">
                  {selectedQrOrder.order.event?.title || 'Подія SKY PARTY'}
                </h3>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  Квиток {selectedQrOrder.subIndex + 1} з {selectedQrOrder.order.quantity || 1}
                </p>
              </div>

              {/* High Contrast Bright QR box for Gate Scanning */}
              <div className="bg-white p-6 rounded-3xl inline-block shadow-[0_0_40px_rgba(255,255,255,0.15)] mx-auto">
                <img
                  src={qrBase64 || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${selectedQrOrder.order.id}:${selectedQrOrder.subIndex + 1}`}
                  alt="QR Code"
                  className="w-48 h-48 mx-auto"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-mono font-bold text-zinc-300">
                  {selectedQrOrder.order.id}-{selectedQrOrder.subIndex + 1}
                </p>
                <p className="text-[11px] text-zinc-500">
                  Покажіть цей код на контролі при вході
                </p>
              </div>

              <button
                onClick={() => setSelectedQrOrder(null)}
                className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase tracking-widest text-xs rounded-2xl transition-all cursor-pointer"
              >
                Закрити
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
