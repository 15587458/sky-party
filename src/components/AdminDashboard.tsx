import { useState } from 'react';
import React from 'react';
import { useApp } from '../contexts/AppContext';
import SeatingChartEditor from './SeatingChartEditor';
import SeatingChartCanvas from './SeatingChartCanvas';
import RichTextEditor from './RichTextEditor';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Download, 
  Upload, 
  Layout, 
  Calendar, 
  LogOut,
  Image as ImageIcon,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronLeft,
  Mail,
  RefreshCw,
  RotateCcw,
  ArrowRight,
  Search,
  Users,
  Settings as SettingsIcon,
  Shield,
  Ticket,
  Phone,
  Grid3X3,
  Maximize,
  BarChart3,
  TrendingUp,
  DollarSign,
  FileText
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, query, orderBy, deleteField } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { getFbFirestore } from '../lib/firebase';
import { Event, SiteConfig, Order, PrivateSettings, Chart, ChartElement } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { Link } from 'react-router-dom';

import QRScanner from './QRScanner';
import { sendTicketEmail } from '../services/emailService';

// Import components for preview
import Navbar from './Navbar';
import { EventDisplay, NoEventsDisplay } from './HomeViews';

// Reusable Monobank Paw Icon component
const MonobankPawIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 inline-block text-[#ff5a5f] select-none align-middle" style={{ minWidth: '16px' }}>
    <circle cx="12" cy="14" r="4" />
    <circle cx="7" cy="8.5" r="2.2" />
    <circle cx="10.5" cy="5.5" r="2.2" />
    <circle cx="14.5" cy="5.5" r="2.2" />
    <circle cx="17.3" cy="8.5" r="2.2" />
  </svg>
);

export default function AdminDashboard() {
  const { rawEvents, events, charts, config, setAdmin, isInitialized, orders, privateSettings, loadChartElements } = useApp();
  const [activeTab, setActiveTab] = useState<'events' | 'config' | 'orders' | 'charts' | 'scanner' | 'stats'>('events');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);
  const [editingChart, setEditingChart] = useState<Partial<Chart> | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [tempConfig, setTempConfig] = useState<SiteConfig | null>(config);
  const [isEditingAboutText, setIsEditingAboutText] = useState(false);
  const [tempAboutText, setTempAboutText] = useState('');
  const [tempPrivate, setTempPrivate] = useState<Partial<PrivateSettings>>({});
  const [isEditingPrivate, setIsEditingPrivate] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isDbOnline, setIsDbOnline] = useState<boolean | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [issuingFreeTicketData, setIssuingFreeTicketData] = useState<{
    isOpen: boolean;
    element?: ChartElement;
    eventId?: string;
    email: string;
    name: string;
    surname: string;
    quantity: number;
    ticketType: 'standard' | 'vip' | 'free';
  } | null>(null);

  // Interactive Admin Map States
  const [showAdminMapSelector, setShowAdminMapSelector] = useState(false);
  const [adminSelectedEventId, setAdminSelectedEventId] = useState<string>('');
  const [adminChartElements, setAdminChartElements] = useState<ChartElement[]>([]);
  const [adminSelectedElement, setAdminSelectedElement] = useState<ChartElement | null>(null);
  const [isAdminMapLoading, setIsAdminMapLoading] = useState(false);
  const [adminMapScale, setAdminMapScale] = useState(1);
  const [viewingOrderElements, setViewingOrderElements] = useState<ChartElement[]>([]);
  const [expandedQrs, setExpandedQrs] = useState<string[]>([]);
  const [individualDownloadingId, setIndividualDownloadingId] = useState<string | null>(null);
  const [isOverallDownloadingPdf, setIsOverallDownloadingPdf] = useState(false);
  const [expandedConfigSections, setExpandedConfigSections] = useState<string[]>(['appearance']);
  const [refundCount, setRefundCount] = useState<number>(1);
  const [refundInvoiceId, setRefundInvoiceId] = useState<string>('');
  const [isRefunding, setIsRefunding] = useState<boolean>(false);

  const toggleConfigSection = (section: string) => {
    setExpandedConfigSections(prev => 
      prev.includes(section) 
        ? prev.filter(id => id !== section) 
        : [...prev, section]
    );
  };

  const toggleQr = (ticketId: string) => {
    setExpandedQrs(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId) 
        : [...prev, ticketId]
    );
  };

  const handleDownloadIndividualTicket = async (ticketSeqId: string, index: number) => {
    if (!viewingOrder) return;
    setIndividualDownloadingId(ticketSeqId);
    try {
      const event = rawEvents.find(e => e.id === viewingOrder.eventId);
      if (!event) return;

      const { getBase64ImageSafe, downloadTicketPDF } = await import('../services/pdfService');

      let eventBase64Img = '';
      if (event.imageUrl) {
        eventBase64Img = await getBase64ImageSafe(event.imageUrl);
      }

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${viewingOrder.id}:${index + 1}`;
      const qrBase64 = await getBase64ImageSafe(qrUrl);

      const tBg = config?.ticketBgColor || '#0a0a0c';
      const tText = config?.ticketTextColor || '#ffffff';
      const tAccent = config?.ticketAccentColor || '#a855f7';
      const tBorder = config?.ticketBorderColor || '#1f1f23';
      const tMsg = config?.ticketMessage || 'ПРИ ВХОДІ ПРЕД\'ЯВІТЬ ЦЕЙ QR-КОД';
      
      let logoBase64Img = '';
      if (config?.ticketLogoUrl || config?.logoUrl) {
        try {
          logoBase64Img = await getBase64ImageSafe(config.ticketLogoUrl || config.logoUrl || '');
        } catch (e) {
          console.warn(e);
        }
      }

      const tempDiv = document.createElement('div');
      tempDiv.id = 'temp-individual-ticket';
      tempDiv.style.position = 'fixed';
      tempDiv.style.top = '0';
      tempDiv.style.left = '0';
      tempDiv.style.width = '600px';
      tempDiv.style.zIndex = '-9999';
      tempDiv.style.pointerEvents = 'none';
      tempDiv.innerHTML = `
        <div style="font-family: system-ui, -apple-system, sans-serif; background: ${tBg}; color: ${tText}; padding: 40px; text-align: center; border: 2px solid ${tBorder}; border-radius: 40px; width: 600px; box-sizing: border-box; position: relative;">
          <div style="margin-bottom: 20px;">
            ${logoBase64Img ? `
              <img src="${logoBase64Img}" style="max-height: 48px; max-width: 280px; object-fit: contain; display: inline-block;" />
            ` : `
              <h2 style="margin: 0; color: ${tAccent}; font-size: 26px; font-weight: 950; letter-spacing: 2px; text-transform: uppercase;">SKY PARTY</h2>
            `}
          </div>
          ${eventBase64Img ? `<img src="${eventBase64Img}" style="width: 100%; max-height: 380px; object-fit: cover; border-radius: 20px; margin-bottom: 30px; border: 1px solid ${tBorder};" />` : ''}
          <h1 style="font-size: 30px; margin: 0 0 10px 0; font-weight: 950; text-transform: uppercase; color: ${tText}; leading: 1.1;">${event.title}</h1>
          <p style="font-size: 16px; color: ${tAccent}; margin-bottom: 30px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
            ${new Date(event.date).toLocaleString('uk-UA', { 
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
            })} | ${event.location}
          </p>
          <div style="background: rgba(255,255,255,0.03); padding: 30px; border-radius: 24px; margin-bottom: 30px; text-align: left; border: 1px solid ${tBorder}; box-sizing: border-box;">
            <div style="margin-bottom: 20px; border-bottom: 1px dashed ${tBorder}; padding-bottom: 15px;">
              <p style="font-size: 10px; color: #71717a; margin: 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">ВЛАСНИК</p>
              <p style="font-size: 24px; font-weight: 900; margin: 5px 0; color: ${tText}; font-family: sans-serif;">${viewingOrder.name} ${viewingOrder.surname}</p>
            </div>
            <div style="display: flex; gap: 40px;">
              <div>
                <p style="font-size: 10px; color: #71717a; margin: 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">ТИП КВИТКА</p>
                <p style="font-size: 20px; font-weight: 950; margin: 5px 0 0 0; color: ${tAccent};">${viewingOrder.ticketType.toUpperCase()}</p>
              </div>
              <div>
                <p style="font-size: 10px; color: #71717a; margin: 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">МІСЦЕ / КВИТОК</p>
                <p style="font-size: 20px; font-weight: 950; margin: 5px 0 0 0; color: ${tText};">${index + 1} з ${viewingOrder.quantity}</p>
              </div>
            </div>
          </div>

          <div style="border-top: 2px dashed ${tBorder}; margin: 25px 0;"></div>

          <div style="background: #111115; padding: 25px; border-radius: 24px; margin-bottom: 20px; border: 1px solid ${tBorder}; text-align: center;">
            <p style="font-size: 10px; color: #71717a; margin: 0 0 15px 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">КВИТОК ${index + 1} З ${viewingOrder.quantity}</p>
            <div style="background: white; padding: 15px; border-radius: 20px; display: inline-block; box-shadow: 0 6px 20px rgba(0,0,0,0.15);">
              <img src="${qrBase64}" style="width: 220px; height: 220px; display: block;" />
            </div>
            <p style="font-family: monospace; font-size: 18px; font-weight: bold; margin: 15px 0 0 0; color: ${tAccent};">${ticketSeqId}</p>
          </div>

          <p style="font-size: 11px; color: #a1a1aa; margin-top: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px;">${tMsg}</p>
        </div>
      `;
      document.body.appendChild(tempDiv);
      await downloadTicketPDF('temp-individual-ticket', ticketSeqId);
      document.body.removeChild(tempDiv);
      showMessage('success', 'PDF завантажено');
    } catch (err) {
      console.error('Error generating individual PDF:', err);
      showMessage('error', 'Помилка завантаження');
    } finally {
      setIndividualDownloadingId(null);
    }
  };

  const db = getFbFirestore();

  // Load seating chart elements for viewing order
  React.useEffect(() => {
    if (viewingOrder) {
      const event = rawEvents.find(e => e.id === viewingOrder.eventId);
      if (event?.chartId) {
        loadChartElements(event.chartId).then(setViewingOrderElements).catch(console.error);
      } else {
        setViewingOrderElements([]);
      }
      setRefundCount(1);
      setRefundInvoiceId(viewingOrder.monobankInvoiceId || '');
    } else {
      setViewingOrderElements([]);
    }
  }, [viewingOrder, rawEvents, loadChartElements]);

  // Scroll Lock
  React.useEffect(() => {
    if (editingEvent || viewingOrder || editingChart || isEditingConfig || isEditingPrivate || showAdminMapSelector || issuingFreeTicketData?.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [editingEvent, viewingOrder, editingChart, isEditingConfig, isEditingPrivate, showAdminMapSelector, issuingFreeTicketData?.isOpen]);

  const handleSelectAdminEvent = async (eventId: string) => {
    setAdminSelectedEventId(eventId);
    setAdminSelectedElement(null);
    const event = rawEvents.find(e => e.id === eventId);
    if (event?.chartId) {
      setIsAdminMapLoading(true);
      try {
        const elements = await loadChartElements(event.chartId);
        setAdminChartElements(elements);
      } catch (err) {
        showMessage('error', 'Помилка завантаження схеми');
      } finally {
        setIsAdminMapLoading(false);
      }
    } else {
      setAdminChartElements([]);
    }
  };

  const handleIssueFreeTicketForElement = (element: ChartElement) => {
    setIssuingFreeTicketData({
      isOpen: true,
      element,
      email: '',
      name: '',
      surname: '',
      quantity: element.type === 'fanzone' ? 1 : 1,
      ticketType: 'free',
    });
  };

  const handleUpdateFanzoneCapacity = async (elementId: string, newCapacity: number) => {
    if (!db) return;
    try {
      const event = rawEvents.find(e => e.id === adminSelectedEventId);
      if (!event?.chartId) return;

      const elementRef = doc(db, 'charts', event.chartId, 'elements', elementId);
      await updateDoc(elementRef, { capacity: newCapacity });
      
      setAdminChartElements(prev => prev.map(el => el.id === elementId ? { ...el, capacity: newCapacity } : el));
      if (adminSelectedElement?.id === elementId) {
        setAdminSelectedElement(prev => prev ? { ...prev, capacity: newCapacity } : null);
      }
      showMessage('success', 'Квоту (місткість) оновлено!');
    } catch (err) {
      console.error(err);
      showMessage('error', 'Помилка оновлення квоти');
    }
  };

  const handleToggleBlockElement = async (elementId: string, currentBlockedState: boolean) => {
    if (!db) {
      showMessage('error', 'Базу не підключено');
      return;
    }
    try {
      const event = rawEvents.find(e => e.id === adminSelectedEventId);
      if (!event?.chartId) {
        showMessage('error', 'Схему залу не знайдено');
        return;
      }

      const elementRef = doc(db, 'charts', event.chartId, 'elements', elementId);
      await updateDoc(elementRef, { isBlocked: !currentBlockedState });
      
      setAdminChartElements(prev => prev.map(el => el.id === elementId ? { ...el, isBlocked: !currentBlockedState } : el));
      setAdminSelectedElement(prev => prev && prev.id === elementId ? { ...prev, isBlocked: !currentBlockedState } : prev);
      
      showMessage('success', !currentBlockedState ? 'Елемент успішно знято з продажу' : 'Елемент успішно повернуто в продаж');
    } catch (err: any) {
      console.error(err);
      showMessage('error', `Помилка оновлення статусу елемента: ${err.message}`);
    }
  };

  // Check connection
  React.useEffect(() => {
    if (!db) {
      setIsDbOnline(false);
      return;
    }
    
    const checkConnection = async () => {
      try {
        // Just try to fetch the config document specifically
        const { getDoc } = await import('firebase/firestore');
        await getDoc(doc(db, 'config', 'settings'));
        setIsDbOnline(true);
      } catch (err) {
        console.warn('DB Connection check failed:', err);
        setIsDbOnline(false);
      }
    };
    
    checkConnection();
  }, [db]);

  const handleSeedDatabase = async () => {
    if (!db) return;
    if (!confirm('Це завантажить демо-події у вашу базу даних. Продовжити?')) return;
    
    try {
      const MOCK_EVENTS = [
        {
          title: 'SKY PARTY: OPEN AIR',
          description: 'Найкраща вечірка літа. Танці під відкритим небом, коктейлі та неймовірна атмосфера.',
          date: '2024-06-15T20:00',
          location: 'Київ, SKY GARDEN',
          price: '500',
          vipPrice: '1500',
          imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80',
          ticketLink: '#',
          isActive: true,
          createdAt: serverTimestamp()
        }
      ];

      for (const ev of MOCK_EVENTS) {
        await addDoc(collection(db, 'events'), ev);
      }
      
      const DEFAULT_CONFIG = {
        instagramUrl: 'https://instagram.com/sky_party_kyiv',
        bannerTitle: 'SKY PARTY',
        footerText: '© 2026 SKY PARTY',
        noEventsMessage: 'Зараз немає актуальних подій'
      };
      
      await setDoc(doc(db, 'config', 'settings'), DEFAULT_CONFIG);
      
      showMessage('success', 'Базу ініціалізовано');
    } catch (err) {
      console.error(err);
      showMessage('error', 'Помилка ініціалізації');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      showMessage('error', 'Логотип занадто великий. Спробуйте менше 800КБ.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (tempConfig) {
        setTempConfig({ ...tempConfig, logoUrl: reader.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTicketLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      showMessage('error', 'Логотип квитка занадто великий. Спробуйте менше 800КБ.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (tempConfig) {
        setTempConfig({ ...tempConfig, ticketLogoUrl: reader.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) { // Roughly 800KB to stay safe in Firestore 1MB limit
      showMessage('error', 'Зображення занадто велике. Спробуйте менше 800КБ.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (editingEvent) {
        setEditingEvent({ ...editingEvent, imageUrl: reader.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveChart = async (elements: ChartElement[], background?: string) => {
    try {
      const db = getFbFirestore();
      if (!db) return;

      // Check background image size if it exists
      if (background && background.length > 800000) { // roughly 800KB
        showMessage('error', 'Зображення фону занадто велике. Максимум 800КБ.');
        return;
      }

      const { writeBatch, collection: fbCollection, doc: fbDoc } = await import('firebase/firestore');

      let chartId = editingChart?.id;
      
      if (chartId) {
        // Prepare main doc update - use setDoc WITHOUT merge to absolutely purge any hidden heavy fields
        const chartRef = fbDoc(db, 'charts', chartId);
        
        // We MUST NOT pass elements here. 
        const docData = {
          name: editingChart?.name || 'Новий зал',
          backgroundImage: background || '',
          updatedAt: serverTimestamp(),
          createdAt: editingChart?.createdAt || Date.now(),
          elementsCount: elements.length
        };

        await setDoc(chartRef, docData);

        // 1. Delete old elements (This is tricky for large charts, but necessary if we want a clean state)
        // For simplicity and safety, we skip full delete if we can just overwrite, 
        // but IDs might have changed. Better to delete or use a versioned collection.
        // For now, we will just save the new elements. 
        // TIP: To fully resolve the 1MB limit, we MUST NOT save 'elements' field in main doc.
      } else {
        const newChartRef = await addDoc(fbCollection(db, 'charts'), {
          name: editingChart?.name || 'Новий зал',
          backgroundImage: background || '',
          createdAt: serverTimestamp(),
          elementsCount: elements.length
        });
        chartId = newChartRef.id;
      }

      // 2. Save elements in subcollection using batches
      const elementsRef = fbCollection(db, 'charts', chartId, 'elements');
      
      // Split elements into chunks of 450 (safe limit for batch of 500, leaving some room)
      for (let i = 0; i < elements.length; i += 450) {
        const batch = writeBatch(db);
        const chunk = elements.slice(i, i + 450);
        
        chunk.forEach(el => {
          const elRef = fbDoc(elementsRef, el.id);
          // Sanitize element to remove undefined fields which Firestore doesn't allow
          const sanitizedEl = JSON.parse(JSON.stringify(el));
          batch.set(elRef, sanitizedEl);
        });
        
        await batch.commit();
      }

      showMessage('success', 'Схему збережено успішно');
      setEditingChart(null);
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, 'charts');
      showMessage('error', 'Помилка збереження схеми');
    }
  };

  const handleEditChart = async (chart: Chart) => {
    try {
      showMessage('success', 'Завантаження елементів...');
      const elements = await loadChartElements(chart.id);
      setEditingChart({ ...chart, elements });
    } catch (err) {
      showMessage('error', 'Помилка завантаження схеми');
    }
  };

  const handleDeleteChart = async (id: string) => {
    if (!confirm('Видалити цю схему?')) return;
    try {
      await deleteDoc(doc(db!, 'charts', id));
      showMessage('success', 'Схему видалено');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `charts/${id}`);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    const db = getFbFirestore();
    if (!db) {
      showMessage('error', 'Firebase не налаштовано');
      return;
    }

    try {
      // Prepare data for save
      // Create a clean copy and remove fields we don't want in Firestore
      const eventToSave = { ...editingEvent };
      delete (eventToSave as any).id;
      delete (eventToSave as any).seatingChart;
      
      // Ensure required fields are present
      const finalData = {
        ...eventToSave,
        title: eventToSave.title || 'Нова подія',
        date: eventToSave.date || new Date().toISOString().slice(0, 16),
        isActive: !!eventToSave.isActive,
        hasSeatingChart: eventToSave.hasSeatingChart !== false
      };

      // Remove undefined fields
      const sanitizedData = JSON.parse(JSON.stringify(finalData));

      if (editingEvent.id && !editingEvent.id.startsWith('mock-')) {
        // Update existing
        await updateDoc(doc(db, 'events', editingEvent.id), {
          ...sanitizedData,
          updatedAt: serverTimestamp()
        });
        showMessage('success', 'Подію оновлено');
      } else {
        // Add new (or clone mock)
        await addDoc(collection(db, 'events'), {
          ...sanitizedData,
          createdAt: serverTimestamp()
        });

        // Reset chosen seating chart elements back to default stock values (isBlocked: false, fanzone capacity: 50)
        if (sanitizedData.chartId) {
          try {
            const { getDocs, collection: fbCollection, writeBatch, doc: fbDoc } = await import('firebase/firestore');
            const elementsSnapshot = await getDocs(fbCollection(db, 'charts', sanitizedData.chartId, 'elements'));
            const batch = writeBatch(db);
            let hasChanges = false;
            
            elementsSnapshot.docs.forEach(elDoc => {
              const elData = elDoc.data();
              const elRef = fbDoc(db, 'charts', sanitizedData.chartId, 'elements', elDoc.id);
              let updatedFields: any = {};
              let elChanged = false;
              
              if (elData.isBlocked !== false) {
                updatedFields.isBlocked = false;
                elChanged = true;
              }
              
              if (elData.type === 'fanzone') {
                if (elData.capacity !== 50) {
                  updatedFields.capacity = 50;
                  elChanged = true;
                }
              }
              
              if (elChanged) {
                batch.update(elRef, updatedFields);
                hasChanges = true;
              }
            });
            
            if (hasChanges) {
              await batch.commit();
            }
          } catch (chartResetErr) {
            console.error('Error resetting chart elements on new event creation:', chartResetErr);
          }
        }

        showMessage('success', editingEvent.id?.startsWith('mock-') ? 'Тестову подію клоновано' : 'Подію додано');
      }
      setEditingEvent(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, editingEvent.id ? `events/${editingEvent.id}` : 'events');
      showMessage('error', 'Помилка збереження');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (id.startsWith('mock-')) {
      showMessage('error', 'Неможливо видалити тестову подію.');
      return;
    }
    if (!confirm('Ви впевнені, що хочете видалити цю подію?')) return;
    const db = getFbFirestore();
    if (!db) {
      showMessage('error', 'Firebase не налаштовано');
      return;
    }
    try {
      await deleteDoc(doc(db, 'events', id));
      showMessage('success', 'Подію видалено');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `events/${id}`);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempConfig) return;
    try {
      await setDoc(doc(db!, 'config', 'settings'), tempConfig);
      showMessage('success', 'Налаштування оновлено');
      setIsEditingConfig(false);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'config/settings');
    }
  };

  const handleSavePrivate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db!, 'settings', 'private'), tempPrivate);
      showMessage('success', 'Приватні налаштування оновлено');
      setIsEditingPrivate(false);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/private');
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db!, 'orders', orderId), { status });
      
      // If status is changed to 'paid', send ticket email
      if (status === 'paid') {
        const order = orders.find(o => o.id === orderId);
        if (order) {
          const event = rawEvents.find(e => e.id === order.eventId);
          if (event) {
            await sendTicketEmail(
              order.id, 
              order.email, 
              order.name, 
              order.surname, 
              event, 
              order.ticketType, 
              privateSettings,
              undefined, // We don't easily have selectedSeat here but the template will work
              order.quantity || 1,
              config
            );

            try {
              const { notifyOrderPaid } = await import('../services/telegramService');
              await notifyOrderPaid(order, event, privateSettings);
            } catch (tgErr) {
              console.error('Telegram notification error:', tgErr);
            }
          }
        }
      }
      
      showMessage('success', `Статус змінено на ${status}`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
    }
  };

  const handleTicketRefund = async (order: Order, countToRefund: number, invoiceIdToRefund: string) => {
    if (!db) return;
    setIsRefunding(true);

    try {
      // Calculate unit price and total refund amount
      const unitPrice = Math.floor(order.price / order.quantity);
      const refundSum = Math.ceil(unitPrice * countToRefund);

      // If invoice ID is specified and Monobank token is configured, perform automated refund
      if (invoiceIdToRefund && privateSettings?.monobankToken) {
        showMessage('success', 'Надсилаємо запит на повернення коштів в Monobank...');
        
        await axios.post("/api/monobank/refund", {
          invoiceId: invoiceIdToRefund,
          amount: refundSum * 100, // in kopecks
          token: privateSettings.monobankToken
        });
      }

      // Update order state in Firestore
      const newReturnedCount = (order.returnedCount || 0) + countToRefund;
      let newStatus = order.status;

      // If all tickets are now refunded, status changes to 'cancelled'
      if (newReturnedCount >= order.quantity) {
        newStatus = 'cancelled';
      }

      await updateDoc(doc(db, 'orders', order.id), {
        returnedCount: newReturnedCount,
        status: newStatus,
        monobankInvoiceId: invoiceIdToRefund || order.monobankInvoiceId || ''
      });

      // Update local viewingOrder state immediately in the Dashboard UI
      if (viewingOrder && viewingOrder.id === order.id) {
        setViewingOrder({
          ...viewingOrder,
          returnedCount: newReturnedCount,
          status: newStatus,
          monobankInvoiceId: invoiceIdToRefund || order.monobankInvoiceId || ''
        });
      }

      // Show success message
      showMessage('success', `Успішно повернено ${countToRefund} квитків на суму ${refundSum} грн.`);
    } catch (err: any) {
      console.error(err);
      showMessage('error', `Помилка повернення коштів: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsRefunding(false);
    }
  };

  const handleIssueFreeTicket = () => {
    const defaultEventId = rawEvents.length > 0 ? rawEvents[0].id : '';
    setIssuingFreeTicketData({
      isOpen: true,
      eventId: defaultEventId,
      email: '',
      name: '',
      surname: '',
      quantity: 1,
      ticketType: 'standard',
    });
  };

  const submitFreeTicketFromModal = async () => {
    if (!db || !issuingFreeTicketData) return;

    const { element, eventId, email, name, surname, quantity, ticketType } = issuingFreeTicketData;
    const finalEventId = element ? adminSelectedEventId : eventId;

    if (!finalEventId) {
      showMessage('error', 'Виберіть подію!');
      return;
    }

    try {
      const event = rawEvents.find(e => e.id === finalEventId);
      const finalQuantity = Number(quantity) || 1;

      if (element) {
        // Issuing for seating chart element
        const orderId = `SKY-FREE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const orderData: Order = {
          id: orderId,
          eventId: finalEventId,
          name: name || 'Клієнт',
          surname: surname || '',
          email,
          phone: 'INTERNAL-COMP',
          status: 'paid',
          price: 0,
          quantity: finalQuantity,
          ticketType: 'free',
          elementId: element.id,
          scannedCount: 0,
          createdAt: Date.now()
        };

        await setDoc(doc(db, 'orders', orderId), orderData);

        if (event) {
          await sendTicketEmail(
            orderId, 
            email, 
            name || 'Клієнт', 
            surname || '', 
            event, 
            'free', 
            privateSettings || undefined, 
            element, 
            finalQuantity,
            config
          );

          try {
            const { notifyOrderPaid } = await import('../services/telegramService');
            await notifyOrderPaid(orderData, event, privateSettings, element.label);
          } catch (tgErr) {
            console.error('Telegram notification error:', tgErr);
          }
        }

        showMessage('success', `Квиток успішно видано та надіслано на ${email}`);
      } else {
        // General manual tickets
        for (let i = 0; i < finalQuantity; i++) {
          const orderId = `SKY-MANUAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const orderData: Order = {
            id: orderId,
            eventId: finalEventId,
            name: name || 'Клієнт',
            surname: surname || '',
            email,
            phone: 'INTERNAL',
            status: 'paid',
            price: 0,
            quantity: 1,
            ticketType,
            scannedCount: 0,
            createdAt: Date.now()
          };

          await setDoc(doc(db, 'orders', orderId), orderData);

          if (event) {
            await sendTicketEmail(orderId, email, name || 'Клієнт', surname || '', event, ticketType, privateSettings, undefined, 1, config);
            
            try {
              const { notifyOrderPaid } = await import('../services/telegramService');
              await notifyOrderPaid(orderData, event, privateSettings);
            } catch (tgErr) {
              console.error('Telegram notification error:', tgErr);
            }
          }
        }
        showMessage('success', `${quantity} квитків видано та надіслано окремо`);
      }

      setIssuingFreeTicketData(null);
    } catch (err: any) {
      console.error(err);
      showMessage('error', `Помилка збереження квитка: ${err.message}`);
    }
  };

  const handleExport = () => {
    const data = {
      events: rawEvents,
      config
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sky-party-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage('success', 'Базу вивантажено');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.events && Array.isArray(data.events)) {
          // Import events
          for (const ev of data.events) {
            const { id, ...evData } = ev;
            await addDoc(collection(db, 'events'), evData);
          }
        }
        if (data.config) {
          await setDoc(doc(db, 'config', 'settings'), data.config);
        }
        showMessage('success', 'Дані імпортовано успішно');
      } catch (err) {
        showMessage('error', 'Помилка імпорту');
      }
    };
    reader.readAsText(file);
  };

  if (isPreviewMode) {
    return (
      <div className="min-h-screen bg-black relative">
        <button 
          onClick={() => setIsPreviewMode(false)}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold shadow-2xl hover:scale-105 transition-all"
        >
          <ChevronLeft size={20} />
          Повернутися в адмін-панель
        </button>
        <div className="pointer-events-none opacity-50 absolute inset-0 border-8 border-purple-500/20 rounded-[40px] m-4 hidden lg:block" />
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main>
            {events.find(e => e.isActive) ? (
              <EventDisplay event={events.find(e => e.isActive)!} />
            ) : (
              config && <NoEventsDisplay config={config} />
            )}
          </main>
          {config && (
            <footer className="py-8 border-t border-zinc-900 text-center text-zinc-600 text-sm">
              {config.footerText}
            </footer>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col text-white">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-6 sticky top-0 z-[60] backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="font-bold text-lg tracking-tight uppercase text-transparent bg-clip-text bg-linear-to-r from-white to-zinc-400">SKY PARTY ADMIN</h1>
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                isDbOnline === true ? "bg-green-500" : isDbOnline === false ? "bg-red-500" : "bg-zinc-600"
              )} />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {isDbOnline === true ? "Firebase Online" : isDbOnline === false ? "Disconnected" : "Connecting..."}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {message && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold animate-in fade-in slide-in-from-right-4",
              message.type === 'success' ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
            )}>
              {message.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {message.text}
            </div>
          )}
          
          <Link 
            to="/"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-850 transition-all border border-zinc-800"
            title="На сайт"
          >
            <ArrowRight size={18} />
          </Link>

          <div className="h-4 w-[1px] bg-zinc-800 mx-1 hidden sm:block" />
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExport}
              className="p-2.5 rounded-xl bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-850 transition-all border border-zinc-800"
              title="Експорт бази"
            >
              <Download size={16} />
            </button>
            <label className="p-2.5 rounded-xl bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-850 transition-all cursor-pointer border border-zinc-800" title="Імпорт бази">
              <Upload size={16} />
              <input type="file" className="hidden" onChange={handleImport} accept=".json" />
            </label>
          </div>
          <button 
            onClick={() => setAdmin(false)}
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-medium ml-2"
          >
            <LogOut size={16} className="text-zinc-500 hover:text-white transition-colors" />
            <span className="hidden sm:inline">Вийти</span>
          </button>
        </div>
      </header>

      {/* Main split dashboard layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-[calc(100vh-64px)] overflow-hidden">
        {/* Modern Sidebar component */}
        <aside className="w-full md:w-64 bg-zinc-950/60 border-b md:border-b-0 md:border-r border-zinc-900 p-4 shrink-0 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="hidden md:block px-3 mb-2">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Панель управління</span>
            </div>

            <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
              {[
                { id: 'stats', label: 'Статистика', icon: BarChart3, group: 'analytics' },
                { id: 'events', label: 'Події', icon: Calendar, group: 'operations' },
                { id: 'orders', label: 'Замовлення', icon: Ticket, group: 'operations' },
                { id: 'charts', label: 'Зали', icon: Grid3X3, group: 'settings' },
                { id: 'config', label: 'Сайт', icon: SettingsIcon, group: 'settings' },
                { id: 'scanner', label: 'Сканер', icon: Maximize, group: 'system', isBadge: true },
              ].map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "relative px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-3 w-full shrink-0",
                      isActive 
                        ? "text-purple-400 bg-purple-500/10 border border-purple-500/10" 
                        : "text-zinc-400 hover:text-zinc-250 hover:bg-zinc-900/40 border border-transparent"
                    )}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="activeTabPill" 
                        className="absolute inset-0 bg-purple-500/10 rounded-2xl border border-purple-500/20 -z-10"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <TabIcon size={16} className={cn("shrink-0", isActive ? "text-purple-400" : "text-zinc-500")} />
                    <span>{tab.label}</span>
                    {tab.isBadge && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-purple-500 animate-pulse hidden md:block" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Stats indicator at bottom of sidebar on desktop */}
          <div className="hidden md:block p-4 rounded-2xl bg-zinc-900/35 border border-zinc-900/60 mt-auto">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-purple-400 animate-pulse" />
              <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Швидка зведення</span>
            </div>
            <div className="mt-2 text-xs text-zinc-400 space-y-1">
              <p>Усього подій: <span className="text-white font-bold">{rawEvents.length}</span></p>
              <p>Замовлень: <span className="text-white font-bold">{orders.length}</span></p>
            </div>
          </div>
        </aside>

        {/* Content area */}
        <main className="flex-1 p-6 overflow-y-auto bg-zinc-950/20 h-[calc(100vh-64px)]">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.99, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.99, y: -8 }}
                transition={{ duration: 0.15, ease: "easeInOut" }}
                className="space-y-6"
              >
                {activeTab === 'events' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Керування подіями</h2>
                <button 
                  onClick={() => {
                    setEditingEvent({ 
                      title: '', 
                      isActive: false, 
                      price: '', 
                      hasSeatingChart: false,
                      imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80',
                      location: 'SKY GARDEN',
                      date: new Date().toISOString().slice(0, 16)
                    });
                  }}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl font-bold transition-all"
                >
                  <Plus size={20} />
                  Додати подію
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rawEvents.length === 0 && (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl space-y-4">
                    <p className="text-zinc-500 font-medium text-center">У базі немає подій</p>
                    <button 
                      onClick={handleSeedDatabase}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-xl font-bold transition-all"
                    >
                      Тимчасово заповнити демо-даними
                    </button>
                  </div>
                )}
                {rawEvents.map((event) => {
                  const isEnded = event.endDate && event.endDate < Date.now();
                  return (
                    <div 
                      key={event.id} 
                      className={cn(
                        "p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col gap-4 group transition-all",
                        isEnded && "opacity-50 grayscale-[0.6] hover:opacity-100 hover:grayscale-0"
                      )}
                    >
                      <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5 border border-neon-purple/30">
                        <img src={event.imageUrl} alt={event.title} className="w-full h-full object-contain transition-transform group-hover:scale-105" />
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                          {event.isActive && (
                            <div className="bg-green-500 text-black text-[10px] font-bold px-2 py-1 rounded-md uppercase">
                              Активна
                            </div>
                          )}
                          {isEnded && (
                            <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase">
                              Закінчена
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg truncate">{event.title}</h3>
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(event.id);
                            showMessage('success', `ID заходу "${event.title}" скопійовано: ${event.id}`);
                          }}
                          className="inline-flex items-center gap-1.5 mt-1 mb-2 bg-zinc-950/40 hover:bg-zinc-950 px-2.5 py-1 rounded-xl border border-white/5 hover:border-purple-500/30 w-fit select-all cursor-pointer group/id transition-all" 
                          title="Натисніть для копіювання ID заходу"
                        >
                          <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">ID:</span>
                          <span className="text-[10px] font-mono text-purple-400 group-hover/id:text-purple-300 transition-colors uppercase select-all">{event.id}</span>
                        </div>
                        <p className="text-zinc-500 text-sm">
                          {new Date(event.date).toLocaleString('uk-UA', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-800">
                        <div className="flex flex-col">
                          <p className="font-bold">
                            {event.priceMax ? `${event.price} - ${event.priceMax}` : event.price}
                            {(!isNaN(Number(event.price)) || !isNaN(Number(event.priceMax))) ? ' грн' : ''}
                            {event.vipPrice && <span className="text-zinc-500 font-normal"> / {event.vipPrice} грн</span>}
                          </p>
                          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest flex gap-4">
                            <span>Standard</span>
                            {event.vipPrice && <span className="text-purple-500/50">VIP</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setEditingEvent(event)}
                            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                            title="Редагувати"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-2 rounded-lg bg-zinc-800 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Видалити"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold uppercase tracking-tight">Налаштування сайту</h2>
                  <p className="text-zinc-500 text-sm">Керуйте зовнішнім виглядом та системними інтеграціями проекту</p>
                </div>
                {!isEditingConfig && (
                  <button 
                    onClick={() => {
                      setTempConfig(config);
                      setIsEditingConfig(true);
                    }}
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all text-xs uppercase"
                  >
                    <Edit2 size={16} />
                    Редагувати конфіг
                  </button>
                )}
              </div>

              {/* Dedicated "Про нас" Section */}
              <div className="border border-zinc-900 rounded-[24px] bg-zinc-900/40 overflow-hidden transition-all relative p-6 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-4 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/10">
                      <Edit2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white uppercase tracking-wider">Розділ "Про нас"</h3>
                      <p className="text-xs text-zinc-500 font-medium">Редагування інформації про проект, яка відображається відвідувачам</p>
                    </div>
                  </div>
                  {!isEditingAboutText ? (
                    <button 
                      onClick={() => {
                        setTempAboutText(config?.aboutText || '');
                        setIsEditingAboutText(true);
                      }}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl font-bold transition-all text-xs uppercase cursor-pointer"
                    >
                      Редагувати опис
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsEditingAboutText(false)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-xl font-bold transition-all text-xs uppercase cursor-pointer"
                      >
                        Скасувати
                      </button>
                      <button 
                        onClick={async () => {
                          if (!config) return;
                          try {
                            const updatedConfig = { ...config, aboutText: tempAboutText };
                            await setDoc(doc(db!, 'config', 'settings'), updatedConfig);
                            showMessage('success', 'Інформацію "Про нас" оновлено успішно');
                            setIsEditingAboutText(false);
                          } catch (err: any) {
                            handleFirestoreError(err, OperationType.WRITE, 'config/settings');
                          }
                        }}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl font-bold transition-all text-xs uppercase cursor-pointer"
                      >
                        Зберегти
                      </button>
                    </div>
                  )}
                </div>

                {!isEditingAboutText ? (
                  <div className="bg-zinc-950/20 py-4 px-5 rounded-2xl border border-white/[0.02]">
                    <div 
                      className="text-zinc-300 text-sm leading-relaxed font-light rich-text-content"
                      dangerouslySetInnerHTML={{ __html: config?.aboutText || 'Інформація про проект відсутня.' }}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <RichTextEditor 
                      value={tempAboutText || ''}
                      onChange={setTempAboutText}
                      placeholder="Впишіть сюди інформацію про ваш проект..."
                    />
                  </div>
                )}
              </div>

              {/* Accordion component wrapping the 3 sections */}
              <div className="space-y-4">
                
                {/* Accordion Item 1: Зовнішній вигляд */}
                <div className="border border-zinc-900 rounded-[24px] bg-zinc-900/40 overflow-hidden transition-all">
                  <button
                    onClick={() => toggleConfigSection('appearance')}
                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-zinc-900/20 transition-all text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/10">
                        <Layout size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white uppercase tracking-wider">Зовнішній вигляд та брендинг</h3>
                        <p className="text-xs text-zinc-500 font-medium">Логотип, основні кольори бренду, тексти банера та футера</p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: expandedConfigSections.includes('appearance') ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-zinc-500 hover:text-white"
                    >
                      <ChevronLeft className="-rotate-90" size={18} />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {expandedConfigSections.includes('appearance') && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                      >
                        <div className="px-6 pb-6 pt-2 border-t border-zinc-900/60 divide-y divide-zinc-900/50 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Ловготип (URL)</label>
                              <p className="text-zinc-300 truncate max-w-[300px] text-xs bg-zinc-950/20 py-2.5 px-3 rounded-xl border border-white/[0.02]">{config?.logoUrl || 'Не вказано'}</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Основний колір</label>
                              <div className="flex items-center gap-3 bg-zinc-950/20 py-2 px-3 rounded-xl border border-white/[0.02] w-fit">
                                <div className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: config?.primaryColor || '#a855f7' }} />
                                <p className="text-zinc-300 font-mono text-xs">{config?.primaryColor || '#a855f7'}</p>
                              </div>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Повідомлення про відсутність подій</label>
                              <p className="text-zinc-300 text-sm bg-zinc-950/20 py-2.5 px-3 rounded-xl border border-white/[0.02]">{config?.noEventsMessage}</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Комісія платежу (%)</label>
                              <p className="text-zinc-300 text-sm bg-zinc-950/20 py-2 px-3 rounded-xl border border-white/[0.02] w-fit">{config?.commissionPercentage || 0}%</p>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Текст футера</label>
                              <p className="text-zinc-300 text-sm bg-zinc-950/20 py-2.5 px-3 rounded-xl border border-white/[0.02]">{config?.footerText}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Accordion Item 2: Контакти та Про нас */}
                <div className="border border-zinc-900 rounded-[24px] bg-zinc-900/40 overflow-hidden transition-all">
                  <button
                    onClick={() => toggleConfigSection('contacts')}
                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-zinc-900/20 transition-all text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/10">
                        <Mail size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white uppercase tracking-wider">Контакти та Про нас</h3>
                        <p className="text-xs text-zinc-500 font-medium">Посилання на соцмережі, контактний email, адреса та опис проекту</p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: expandedConfigSections.includes('contacts') ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-zinc-500 hover:text-white"
                    >
                      <ChevronLeft className="-rotate-90" size={18} />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {expandedConfigSections.includes('contacts') && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                      >
                        <div className="px-6 pb-6 pt-2 border-t border-zinc-900/60 divide-y divide-zinc-900/50 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Instagram</label>
                              <p className="text-zinc-300 text-xs bg-zinc-950/20 py-2 px-3 rounded-xl border border-white/[0.02] truncate">{config?.instagramUrl || 'Не вказано'}</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Telegram</label>
                              <p className="text-zinc-300 text-xs bg-zinc-950/20 py-2 px-3 rounded-xl border border-white/[0.02] truncate">{config?.telegramUrl || 'Не вказано'}</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Facebook</label>
                              <p className="text-zinc-300 text-xs bg-zinc-950/20 py-2 px-3 rounded-xl border border-white/[0.02] truncate">{config?.facebookUrl || 'Не вказано'}</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Email зв'язку</label>
                              <p className="text-zinc-300 text-xs bg-zinc-950/20 py-2 px-3 rounded-xl border border-white/[0.02]">{config?.contactEmail || 'Не вказано'}</p>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Адреса проведення</label>
                              <p className="text-zinc-300 text-xs bg-zinc-950/20 py-2 px-3 rounded-xl border border-white/[0.02]">{config?.contactAddress || 'Не вказано'}</p>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Про нас</label>
                              <div 
                                className="text-zinc-300 text-xs bg-zinc-950/20 py-2.5 px-3 rounded-xl border border-white/[0.02] leading-relaxed rich-text-content"
                                dangerouslySetInnerHTML={{ __html: config?.aboutText || 'Не вказано' }}
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Accordion Item 3: Приватні налаштування / Інтеграції */}
                <div className="border border-zinc-900 rounded-[24px] bg-zinc-900/40 overflow-hidden transition-all relative">
                  <button
                    onClick={() => toggleConfigSection('private')}
                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-zinc-900/20 transition-all text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/10">
                        <Shield size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                          Приватні інтеграції (SMTP, Telegram, Monobank <MonobankPawIcon />)
                        </h3>
                        <p className="text-xs text-zinc-500 font-medium font-sans">Платіжний еквайринг, SMTP сервіс пошти, сповіщення в месенджер</p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: expandedConfigSections.includes('private') ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-zinc-500 hover:text-white"
                    >
                      <ChevronLeft className="-rotate-90" size={18} />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {expandedConfigSections.includes('private') && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                      >
                        <div className="px-6 pb-6 pt-2 border-t border-zinc-900/60 divide-y divide-zinc-900/50 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1">
                                Monobank Token <MonobankPawIcon />
                              </label>
                              <p className="text-zinc-350 font-mono text-xs bg-zinc-950/20 py-2.5 px-3 rounded-xl border border-white/[0.02]">{privateSettings?.monobankToken ? '••••••••' + privateSettings.monobankToken.slice(-4) : 'Не налаштовано'}</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">SMTP Email</label>
                              <p className="text-zinc-350 font-mono text-xs bg-zinc-950/20 py-2.5 px-3 rounded-xl border border-white/[0.02]">{privateSettings?.smtpUser || 'sky.party@ukr.net'}</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">SMTP Password (ukr.net)</label>
                              <p className="text-zinc-350 font-mono text-xs bg-zinc-950/20 py-2.5 px-3 rounded-xl border border-white/[0.02]">{privateSettings?.smtpPass ? '••••••••' : 'Не налаштовано'}</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Telegram Bot Token</label>
                              <p className="text-zinc-350 font-mono text-xs bg-zinc-950/20 py-2.5 px-3 rounded-xl border border-white/[0.02]">{privateSettings?.telegramBotToken ? '••••••••' + privateSettings.telegramBotToken.slice(-4) : 'Не налаштовано'}</p>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2 bg-zinc-950/10 p-4 rounded-2xl border border-zinc-900">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Telegram Chat ID</label>
                                  <p className="text-zinc-350 font-mono text-xs bg-zinc-950/20 py-1.5 px-2.5 rounded-lg border border-white/[0.02] w-fit">{privateSettings?.telegramChatId || 'Не налаштовано'}</p>
                                </div>
                                <button 
                                  onClick={() => {
                                    setTempPrivate(privateSettings || {});
                                    setIsEditingPrivate(true);
                                  }}
                                  className="bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-300 font-bold py-2.5 px-4 rounded-xl text-xs uppercase border border-zinc-750/50 shadow-md active:scale-95 transition-all text-center"
                                >
                                  Керувати токенами
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
               <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold uppercase tracking-tight">Замовлення та квитки</h2>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <input 
                      type="text"
                      placeholder="Пошук (ім'я, email, ID)..."
                      value={orderSearch}
                      onChange={e => setOrderSearch(e.target.value)}
                      className="h-10 bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none w-64"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      const activeEvents = rawEvents.filter(e => e.isActive && e.hasSeatingChart);
                      if (activeEvents.length > 0) {
                        handleSelectAdminEvent(activeEvents[0].id!);
                      } else if (rawEvents.length > 0) {
                        handleSelectAdminEvent(rawEvents[0].id!);
                      }
                      setShowAdminMapSelector(true);
                    }}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase transition-all shadow-lg shadow-purple-500/20"
                  >
                    <Grid3X3 size={16} />
                    Видати через карту
                  </button>
                  <button 
                    onClick={() => handleIssueFreeTicket()}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-zinc-200 transition-all"
                  >
                    <Plus size={16} />
                    Видати квиток
                  </button>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-zinc-950/50 text-[10px] font-black uppercase text-zinc-500 tracking-widest border-b border-zinc-800">
                        <th className="px-6 py-4">ID / Дата</th>
                        <th className="px-6 py-4">Клієнт</th>
                        <th className="px-6 py-4">Подія</th>
                        <th className="px-6 py-4">Тип / Ціна</th>
                        <th className="px-6 py-4">Статус</th>
                        <th className="px-6 py-4 flex justify-end">Дії</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {(() => {
                        let lastDateStr = '';
                        return orders
                          .filter(o => 
                            (o.id || '').toLowerCase().includes(orderSearch.toLowerCase()) || 
                            (o.name || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
                            (o.surname || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
                            (o.email || '').toLowerCase().includes(orderSearch.toLowerCase())
                          )
                          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                          .map(order => {
                            const orderDate = new Date(order.createdAt || 0);
                            const dayStr = orderDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
                            const showDivider = dayStr !== lastDateStr;
                            lastDateStr = dayStr;
                            return (
                              <React.Fragment key={order.id}>
                                {showDivider && (
                                  <tr className="bg-zinc-950/70 border-y border-zinc-800/80">
                                    <td colSpan={6} className="px-6 py-3 font-black text-[10px] text-purple-400 bg-zinc-950/30 uppercase tracking-widest">
                                      📅 {dayStr}
                                    </td>
                                  </tr>
                                )}
                                <tr className="hover:bg-white/[0.02] transition-colors group">
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                      <span className="font-mono text-xs font-bold text-white">#{order.id}</span>
                                      <span className="text-[10px] text-zinc-500 uppercase">{orderDate.toLocaleTimeString('uk-UA')}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-white">{order.name} {order.surname}</span>
                                      <span className="text-[10px] text-zinc-500 uppercase">{order.email}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                     <div className="flex flex-col">
                                       <span className="text-xs font-bold text-white truncate max-w-[150px]">
                                         {rawEvents.find(e => e.id === order.eventId)?.title || order.eventId}
                                       </span>
                                     </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                       <span className="text-[10px] font-black text-white px-2 py-0.5 rounded bg-zinc-800 w-fit uppercase mb-1">
                                         {order.ticketType}
                                       </span>
                                       <span className="text-sm font-black text-white">{order.price} грн</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={cn(
                                      "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                      order.status === 'paid' ? "bg-green-500/10 text-green-500" : 
                                      order.status === 'used' ? "bg-blue-500/10 text-blue-500" :
                                      order.status === 'cancelled' ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"
                                    )}>
                                      {order.status === 'paid' ? 'сплачено' : 
                                       order.status === 'used' ? 'проскановано' :
                                       order.status === 'cancelled' ? 'скасовано' : 'очікує'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                     <div className="flex justify-end gap-2 text-zinc-500">
                                        {order.status === 'pending' && (
                                          <button 
                                            onClick={() => updateOrderStatus(order.id, 'paid')}
                                            className="p-1.5 hover:bg-white/10 text-green-500 rounded-lg transition-all"
                                            title="Підтвердити"
                                          >
                                            <CheckCircle2 size={14} />
                                          </button>
                                        )}
                                        <button 
                                          onClick={() => setViewingOrder(order)}
                                          className="p-1.5 hover:bg-white/10 rounded-lg transition-all hover:text-white"
                                          title="Деталі"
                                        >
                                           <Eye size={14} />
                                        </button>
                                        <button 
                                          onClick={async () => {
                                            if(confirm('Видалити замовлення?')) {
                                              try {
                                                await deleteDoc(doc(db!, 'orders', order.id));
                                                showMessage('success', 'Замовлення видалено');
                                              } catch(err) {
                                                showMessage('error', 'Помилка видалення');
                                              }
                                            }
                                          }}
                                          className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-red-500"
                                          title="Видалити"
                                        >
                                           <Trash2 size={14} />
                                        </button>
                                     </div>
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold uppercase tracking-tight">Схеми залів</h2>
                <button 
                  onClick={() => {
                    const name = prompt('Назва залу:');
                    if (name) setEditingChart({ name, elements: [] });
                  }}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl font-bold transition-all"
                >
                  <Plus size={20} />
                  Створити схему
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {charts.length === 0 && (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl space-y-4">
                    <p className="text-zinc-500 font-medium text-center text-sm uppercase tracking-widest font-black">Схем поки немає</p>
                  </div>
                )}
                {charts.map((chart) => (
                  <div key={chart.id} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col gap-4 group hover:border-purple-500/50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-purple-500 border border-white/5">
                        <Grid3X3 size={24} />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEditChart(chart)}
                          className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all border border-white/5"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteChart(chart.id)}
                          className="p-2 rounded-xl bg-zinc-800 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">{chart.name}</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        {chart.elementsCount || 0} елементів
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'scanner' && (
            <div className="max-w-xl mx-auto py-10 animate-in zoom-in-95 duration-300">
               <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] overflow-hidden shadow-2xl p-1">
                  <QRScanner />
               </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold uppercase tracking-tight">Статистика та Звіти</h2>
                  <p className="text-zinc-500 text-sm">Огляд продажів та формування звітів по подіях</p>
                </div>
                <div className="flex items-center gap-3">
                  <select 
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none min-w-[200px]"
                  >
                    <option value="all">Усі події</option>
                    {rawEvents.map(event => (
                      <option key={event.id} value={event.id}>{event.title}</option>
                    ))}
                  </select>
                  {selectedEventId !== 'all' && (
                    <button 
                      onClick={async () => {
                        const event = rawEvents.find(e => e.id === selectedEventId);
                        if (!event) return;
                        
                        const eventOrders = orders.filter(o => o.eventId === selectedEventId && (o.status === 'paid' || o.status === 'used'));
                        
                        // Simple CSV report
                        const headers = ["ID Замовлення", "Клієнт", "Email", "Тип", "Кількість", "Ціна", "Дата"];
                        const rows = eventOrders.map(o => [
                          o.id,
                          `${o.name} ${o.surname}`,
                          o.email,
                          o.ticketType,
                          o.quantity,
                          o.price,
                          new Date(o.createdAt).toLocaleString()
                        ]);
                        
                        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `report-${event.title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        showMessage('success', 'Звіт сформовано (CSV)');
                      }}
                      className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-zinc-200 transition-all shadow-xl"
                    >
                      <FileText size={16} />
                      Звіт CSV
                    </button>
                  )}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Загальний дохід', value: `${orders.filter(o => o.status === 'paid' || o.status === 'used').filter(o => selectedEventId === 'all' || o.eventId === selectedEventId).reduce((acc, o) => acc + (o.price || 0), 0)} грн`, icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10' },
                  { label: 'Продано квитків', value: orders.filter(o => o.status === 'paid' || o.status === 'used').filter(o => selectedEventId === 'all' || o.eventId === selectedEventId).reduce((acc, o) => acc + (o.quantity || 1), 0), icon: Ticket, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                  { label: 'VIP квитки', value: orders.filter(o => (o.status === 'paid' || o.status === 'used') && o.ticketType === 'vip').filter(o => selectedEventId === 'all' || o.eventId === selectedEventId).reduce((acc, o) => acc + (o.quantity || 1), 0), icon: Shield, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
                  { label: 'Активні події', value: rawEvents.filter(e => e.isActive).length, icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' }
                ].map((stat, i) => (
                  <div key={i} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bg)}>
                      <stat.icon className={stat.color} size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{stat.label}</p>
                      <p className="text-2xl font-black text-white">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2 text-zinc-400 uppercase text-xs tracking-widest">
                      <TrendingUp size={16} />
                      Динаміка продажів
                    </h3>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(() => {
                        const filtered = orders.filter(o => (o.status === 'paid' || o.status === 'used') && (selectedEventId === 'all' || o.eventId === selectedEventId));
                        // Group by day for the last 7 days or by event if 'all'
                        if (selectedEventId === 'all') {
                          return rawEvents.map(e => ({
                            name: e.title.substring(0, 10) + '...',
                            revenue: orders.filter(o => o.eventId === e.id && (o.status === 'paid' || o.status === 'used')).reduce((acc, o) => acc + (o.price || 0), 0)
                          }));
                        } else {
                          // Last 7 days
                          const days = Array.from({length: 7}, (_, i) => {
                            const d = new Date();
                            d.setDate(d.getDate() - i);
                            return d.toISOString().split('T')[0];
                          }).reverse();
                          
                          return days.map(day => ({
                            name: day.split('-').slice(1).reverse().join('.'),
                            revenue: filtered.filter(o => new Date(o.createdAt).toISOString().split('T')[0] === day).reduce((acc, o) => acc + (o.price || 0), 0)
                          }));
                        }
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#52525b" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="#52525b" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => `${value}₴`}
                        />
                        <Tooltip 
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }}
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        />
                        <Bar 
                          dataKey="revenue" 
                          fill="#a855f7" 
                          radius={[4, 4, 0, 0]} 
                          barSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Ticket Types Pie Chart */}
                <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
                  <h3 className="font-bold flex items-center gap-2 text-zinc-400 uppercase text-xs tracking-widest">
                    <BarChart3 size={16} />
                    Розподіл квитків
                  </h3>
                  <div className="h-[250px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={(() => {
                            const filtered = orders.filter(o => (o.status === 'paid' || o.status === 'used') && (selectedEventId === 'all' || o.eventId === selectedEventId));
                            const standard = filtered.filter(o => o.ticketType === 'standard').reduce((acc, o) => acc + (o.quantity || 1), 0);
                            const vip = filtered.filter(o => o.ticketType === 'vip').reduce((acc, o) => acc + (o.quantity || 1), 0);
                            const free = filtered.filter(o => o.ticketType === 'free').reduce((acc, o) => acc + (o.quantity || 1), 0);
                            return [
                              { name: 'Standard', value: standard, color: '#a855f7' },
                              { name: 'VIP', value: vip, color: '#eab308' },
                              { name: 'Free', value: free, color: '#22c55e' }
                            ].filter(d => d.value > 0);
                          })()}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {(() => {
                            const filtered = orders.filter(o => (o.status === 'paid' || o.status === 'used') && (selectedEventId === 'all' || o.eventId === selectedEventId));
                            const standard = filtered.filter(o => o.ticketType === 'standard').reduce((acc, o) => acc + (o.quantity || 1), 0);
                            const vip = filtered.filter(o => o.ticketType === 'vip').reduce((acc, o) => acc + (o.quantity || 1), 0);
                            const free = filtered.filter(o => o.ticketType === 'free').reduce((acc, o) => acc + (o.quantity || 1), 0);
                            return [
                              { name: 'Standard', value: standard, color: '#a855f7' },
                              { name: 'VIP', value: vip, color: '#eab308' },
                              { name: 'Free', value: free, color: '#22c55e' }
                            ].filter(d => d.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ));
                          })()}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const filtered = orders.filter(o => (o.status === 'paid' || o.status === 'used') && (selectedEventId === 'all' || o.eventId === selectedEventId));
                      const standard = filtered.filter(o => o.ticketType === 'standard').reduce((acc, o) => acc + (o.quantity || 1), 0);
                      const vip = filtered.filter(o => o.ticketType === 'vip').reduce((acc, o) => acc + (o.quantity || 1), 0);
                      const free = filtered.filter(o => o.ticketType === 'free').reduce((acc, o) => acc + (o.quantity || 1), 0);
                      return [
                        { name: 'Standard', value: standard, color: 'bg-purple-500' },
                        { name: 'VIP', value: vip, color: 'bg-yellow-500' },
                        { name: 'Free', value: free, color: 'bg-green-500' }
                      ];
                    })().map((type, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-zinc-400">
                          <div className={cn("w-2 h-2 rounded-full", type.color)} />
                          {type.name}
                        </div>
                        <span className="font-bold">{type.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
              <div className="flex flex-col">
                <h3 className="font-bold text-xl">{editingEvent.id ? 'Редагувати подію' : 'Нова подія'}</h3>
                {editingEvent.id && (
                  <div 
                    onClick={() => {
                      navigator.clipboard.writeText(editingEvent.id || '');
                      showMessage('success', `ID заходу скопійовано: ${editingEvent.id}`);
                    }}
                    className="flex items-center gap-1.5 mt-1 bg-zinc-950/40 hover:bg-zinc-950 border border-white/5 px-2 py-0.5 rounded-lg select-all cursor-pointer text-[10px] text-zinc-400 w-fit font-mono hover:text-purple-400 transition-colors"
                    title="Натисніть для копіювання ID заходу"
                  >
                    <span>ID:</span>
                    <span className="uppercase">{editingEvent.id}</span>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setEditingEvent(null)}
                className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveEvent} className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Назва події</label>
                    <input 
                      type="text" 
                      value={editingEvent.title || ''}
                      onChange={e => setEditingEvent({...editingEvent, title: e.target.value})}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Дата та час початку</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input 
                        type="datetime-local" 
                        value={editingEvent.date || ''}
                        onChange={e => setEditingEvent({...editingEvent, date: e.target.value})}
                        className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-purple-500 outline-none"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Дата та час завершення (для автоматичного видалення)</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input 
                        type="datetime-local" 
                        value={editingEvent.endDate ? new Date(editingEvent.endDate - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''}
                        onChange={e => setEditingEvent({...editingEvent, endDate: new Date(e.target.value).getTime()})}
                        className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Локація</label>
                    <input 
                      type="text" 
                      value={editingEvent.location || ''}
                      onChange={e => setEditingEvent({...editingEvent, location: e.target.value})}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Standard (від)</label>
                      <input 
                        type="text" 
                        value={editingEvent.price || ''}
                        onChange={e => setEditingEvent({...editingEvent, price: e.target.value})}
                        placeholder="500"
                        className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Standard (до)</label>
                      <input 
                        type="text" 
                        value={editingEvent.priceMax || ''}
                        onChange={e => setEditingEvent({...editingEvent, priceMax: e.target.value})}
                        placeholder="800"
                        className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase ml-1">VIP (грн)</label>
                      <input 
                        type="text" 
                        value={editingEvent.vipPrice || ''}
                        onChange={e => setEditingEvent({...editingEvent, vipPrice: e.target.value})}
                        placeholder="1500"
                        className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Зображення</label>
                    <div className="space-y-3">
                      {editingEvent.imageUrl && (
                        <div className="relative aspect-video rounded-xl overflow-hidden border border-neon-purple bg-black">
                          <img src={editingEvent.imageUrl} className="w-full h-full object-contain" alt="Preview" />
                          <button 
                            type="button"
                            onClick={() => setEditingEvent({...editingEvent, imageUrl: ''})}
                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black text-white rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                          <input 
                            type="text" 
                            placeholder="Вставте URL або виберіть файл"
                            value={editingEvent.imageUrl || ''}
                            onChange={e => setEditingEvent({...editingEvent, imageUrl: e.target.value})}
                            className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                          />
                        </div>
                        <label className="flex items-center justify-center w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl cursor-pointer hover:bg-zinc-700 transition-colors">
                          <Upload size={18} className="text-zinc-400" />
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleImageUpload}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 col-span-full">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Схема залу</label>
                    <select 
                      value={editingEvent.chartId || ''}
                      onChange={e => setEditingEvent({...editingEvent, chartId: e.target.value})}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">Без схеми (Тільки FAN)</option>
                      {charts.map(chart => (
                        <option key={chart.id} value={chart.id}>{chart.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Посилання на квитки</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input 
                        type="text" 
                        value={editingEvent.ticketLink || ''}
                        onChange={e => setEditingEvent({...editingEvent, ticketLink: e.target.value})}
                        className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Опис</label>
                    <textarea 
                      value={editingEvent.description || ''}
                      onChange={e => setEditingEvent({...editingEvent, description: e.target.value})}
                      className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded-2xl p-4 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                      placeholder="Опишіть вашу подію..."
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 p-4 bg-zinc-950/50 rounded-2xl">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="isActive"
                    checked={editingEvent.isActive || false}
                    onChange={e => setEditingEvent({...editingEvent, isActive: e.target.checked})}
                    className="w-5 h-5 accent-purple-500"
                  />
                  <label htmlFor="isActive" className="font-bold text-sm">Активувати цю подію на головній</label>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="hasSeatingChart"
                    checked={editingEvent.hasSeatingChart !== false}
                    onChange={e => setEditingEvent({...editingEvent, hasSeatingChart: e.target.checked})}
                    className="w-5 h-5 accent-purple-500"
                  />
                  <label htmlFor="hasSeatingChart" className="font-bold text-sm">Використовувати схему залу</label>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="submit"
                  className="flex-1 bg-white text-black h-14 rounded-2xl font-bold text-lg hover:bg-zinc-200 transition-colors"
                >
                  Зберегти подію
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Config Modal */}
      {isEditingConfig && tempConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
              <h3 className="font-bold text-xl">Налаштування сайту</h3>
              <button 
                onClick={() => setIsEditingConfig(false)}
                className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveConfig} className="p-6 space-y-6 overflow-y-auto">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-zinc-500 tracking-widest border-b border-zinc-800 pb-2">Зовнішній вигляд</h4>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Логотип</label>
                    <div className="space-y-3">
                      {tempConfig.logoUrl && (
                        <div className="relative h-20 w-fit rounded-xl overflow-hidden border border-zinc-700 bg-black/50 p-2">
                          <img src={tempConfig.logoUrl} className="h-full object-contain" alt="Logo Preview" />
                          <button 
                            type="button"
                            onClick={() => setTempConfig({...tempConfig, logoUrl: ''})}
                            className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black text-white rounded-md transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                          <input 
                            type="text" 
                            value={tempConfig.logoUrl || ''}
                            onChange={e => setTempConfig({...tempConfig, logoUrl: e.target.value})}
                            className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                            placeholder="URL логотипу або виберіть файл"
                          />
                        </div>
                        <label className="flex items-center justify-center w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl cursor-pointer hover:bg-zinc-700 transition-colors">
                          <Upload size={18} className="text-zinc-400" />
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleLogoUpload}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Основний колір (HEX)</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={tempConfig.primaryColor || '#a855f7'}
                        onChange={e => setTempConfig({...tempConfig, primaryColor: e.target.value})}
                        className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl p-1 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"
                      />
                      <input 
                        type="text" 
                        value={tempConfig.primaryColor || '#a855f7'}
                        onChange={e => setTempConfig({...tempConfig, primaryColor: e.target.value})}
                        className="flex-1 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                        placeholder="#a855f7"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Заголовок банера</label>
                    <input 
                      type="text" 
                      value={tempConfig.bannerTitle || ''}
                      onChange={e => setTempConfig({...tempConfig, bannerTitle: e.target.value})}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Текст коли немає подій</label>
                    <input 
                      type="text" 
                      value={tempConfig.noEventsMessage || ''}
                      onChange={e => setTempConfig({...tempConfig, noEventsMessage: e.target.value})}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Текст футера</label>
                    <input 
                      type="text" 
                      value={tempConfig.footerText || ''}
                      onChange={e => setTempConfig({...tempConfig, footerText: e.target.value})}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h4 className="text-xs font-black uppercase text-zinc-500 tracking-widest border-b border-zinc-800 pb-2">Соціальні мережі</h4>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Instagram URL</label>
                    <input 
                      type="text" 
                      value={tempConfig.instagramUrl || ''}
                      onChange={e => setTempConfig({...tempConfig, instagramUrl: e.target.value})}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Telegram URL</label>
                    <input 
                      type="text" 
                      value={tempConfig.telegramUrl || ''}
                      onChange={e => setTempConfig({...tempConfig, telegramUrl: e.target.value})}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Facebook URL</label>
                    <input 
                      type="text" 
                      value={tempConfig.facebookUrl || ''}
                      onChange={e => setTempConfig({...tempConfig, facebookUrl: e.target.value})}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h4 className="text-xs font-black uppercase text-zinc-500 tracking-widest border-b border-zinc-800 pb-2">Контакти та Інформація</h4>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Email для контактів</label>
                    <input 
                      type="email" 
                      value={tempConfig.contactEmail || ''}
                      onChange={e => setTempConfig({...tempConfig, contactEmail: e.target.value})}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Адреса</label>
                    <input 
                      type="text" 
                      value={tempConfig.contactAddress || ''}
                      onChange={e => setTempConfig({...tempConfig, contactAddress: e.target.value})}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Текст "Про нас"</label>
                    <RichTextEditor 
                      value={tempConfig.aboutText || ''}
                      onChange={val => setTempConfig({...tempConfig, aboutText: val})}
                      placeholder="Введіть детальний опис тут..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Комісія (%)</label>
                    <input 
                      type="number" 
                      value={tempConfig.commissionPercentage || 0}
                      onChange={e => setTempConfig({...tempConfig, commissionPercentage: Number(e.target.value)})}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-zinc-800/80">
                  <h4 className="text-xs font-black uppercase text-zinc-500 tracking-widest border-b border-zinc-800 pb-2">Дизайнер & Конструктор Квитка 🎨</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Логотип квитка (якщо порожньо, використовується лого сайту)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={tempConfig.ticketLogoUrl || ''}
                          onChange={e => setTempConfig({...tempConfig, ticketLogoUrl: e.target.value})}
                          className="flex-1 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none text-sm font-sans"
                          placeholder="URL логотипу квитка"
                        />
                        <label className="flex items-center justify-center w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl cursor-pointer hover:bg-zinc-700 transition-colors shrink-0">
                          <Upload size={18} className="text-zinc-400" />
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleTicketLogoUpload}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Колір фону квитка</label>
                      <div className="flex gap-2">
                        <input 
                          type="color" 
                          value={tempConfig.ticketBgColor || '#000000'}
                          onChange={e => setTempConfig({...tempConfig, ticketBgColor: e.target.value})}
                          className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl p-1 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer shrink-0"
                        />
                        <input 
                          type="text" 
                          value={tempConfig.ticketBgColor || '#000000'}
                          onChange={e => setTempConfig({...tempConfig, ticketBgColor: e.target.value})}
                          className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                          placeholder="#000000"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Колір тексту</label>
                      <div className="flex gap-2">
                        <input 
                          type="color" 
                          value={tempConfig.ticketTextColor || '#ffffff'}
                          onChange={e => setTempConfig({...tempConfig, ticketTextColor: e.target.value})}
                          className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl p-1 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer shrink-0"
                        />
                        <input 
                          type="text" 
                          value={tempConfig.ticketTextColor || '#ffffff'}
                          onChange={e => setTempConfig({...tempConfig, ticketTextColor: e.target.value})}
                          className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Колір акцентів</label>
                      <div className="flex gap-2">
                        <input 
                          type="color" 
                          value={tempConfig.ticketAccentColor || '#a855f7'}
                          onChange={e => setTempConfig({...tempConfig, ticketAccentColor: e.target.value})}
                          className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl p-1 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer shrink-0"
                        />
                        <input 
                          type="text" 
                          value={tempConfig.ticketAccentColor || '#a855f7'}
                          onChange={e => setTempConfig({...tempConfig, ticketAccentColor: e.target.value})}
                          className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                          placeholder="#a855f7"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Колір меж / ліній</label>
                      <div className="flex gap-2">
                        <input 
                          type="color" 
                          value={tempConfig.ticketBorderColor || '#27272a'}
                          onChange={e => setTempConfig({...tempConfig, ticketBorderColor: e.target.value})}
                          className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl p-1 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer shrink-0"
                        />
                        <input 
                          type="text" 
                          value={tempConfig.ticketBorderColor || '#27272a'}
                          onChange={e => setTempConfig({...tempConfig, ticketBorderColor: e.target.value})}
                          className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                          placeholder="#27272a"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Повідомлення на квитку</label>
                      <input 
                        type="text" 
                        value={tempConfig.ticketMessage || ''}
                        onChange={e => setTempConfig({...tempConfig, ticketMessage: e.target.value})}
                        className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                        placeholder="Будь ласка, пред'явіть цей квиток на пошті або в телефоні."
                      />
                    </div>
                  </div>

                  <div className="pt-4 space-y-2">
                    <label className="text-xs font-black uppercase text-zinc-500 tracking-widest block text-center font-sans">ПЕРЕГЛЯД ТА ПЕРЕВІРКА КВИТКА (НАЖИВО) 📱</label>
                    <div 
                      className="rounded-3xl p-6 border-2 font-sans w-full max-w-[340px] mx-auto shadow-2xl transition-all"
                      style={{
                        backgroundColor: tempConfig.ticketBgColor || '#000000',
                        borderColor: tempConfig.ticketBorderColor || '#27272a',
                        color: tempConfig.ticketTextColor || '#ffffff'
                      }}
                    >
                      <div className="text-center space-y-4">
                        <div className="h-10 flex items-center justify-center">
                          {tempConfig.ticketLogoUrl || tempConfig.logoUrl ? (
                            <img 
                              src={tempConfig.ticketLogoUrl || tempConfig.logoUrl} 
                              className="max-h-full object-contain" 
                              alt="Logo"
                            />
                          ) : (
                            <span className="font-sans font-black tracking-[0.3em] uppercase text-sm text-white">SKY PARTY</span>
                          )}
                        </div>

                        <div className="border-t border-b py-3 space-y-1" style={{ borderColor: tempConfig.ticketBorderColor || '#27272a' }}>
                          <h5 className="font-extrabold uppercase text-sm tracking-tight leading-none text-white">VIP ВЕЧІРКА SKY PARTY 2026</h5>
                          <p className="text-[9px] font-bold" style={{ color: tempConfig.ticketAccentColor || '#a855f7' }}>01.01.2026 | SKY CLUB</p>
                        </div>

                        <div className="py-2.5 text-left space-y-2 rounded-xl px-4 bg-white/5 border text-xs" style={{ borderColor: tempConfig.ticketBorderColor || '#27272a' }}>
                          <div>
                            <p className="text-[7px] font-bold opacity-50 uppercase">ВЛАСНИК</p>
                            <h6 className="font-black uppercase text-white">Дмитро Шевченко</h6>
                          </div>
                          <div>
                            <p className="text-[7px] font-bold opacity-50 uppercase">ТИП КВИТКА</p>
                            <h6 className="font-black uppercase" style={{ color: tempConfig.ticketAccentColor || '#a855f7' }}>STANDARD КВИТОК</h6>
                          </div>
                        </div>

                        <div className="border rounded-2xl p-3 inline-block bg-white" style={{ borderColor: tempConfig.ticketBorderColor || '#27272a' }}>
                          <div className="w-20 h-20 bg-zinc-200 border border-zinc-300 flex items-center justify-center rounded-lg overflow-hidden">
                            <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest text-center leading-tight px-1">ПРОСТО QR КОД</span>
                          </div>
                        </div>

                        {tempConfig.ticketMessage && (
                          <p className="text-[10px] font-sans font-bold leading-relaxed">{tempConfig.ticketMessage}</p>
                        )}
                        <p className="text-[8px] opacity-40 uppercase">SKY PARTY • КВИТОК 1 З 1</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="submit"
                  className="flex-1 bg-white text-black h-14 rounded-2xl font-bold text-lg hover:bg-zinc-200 transition-colors"
                >
                  Зберегти зміни
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
              <div className="flex flex-col">
                <h3 className="font-bold text-xl uppercase tracking-tight">Замовлення #{viewingOrder.id}</h3>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  Створено: {new Date(viewingOrder.createdAt || 0).toLocaleString()}
                </span>
              </div>
              <button 
                onClick={() => setViewingOrder(null)}
                className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Client & Details */}
              <div className="lg:col-span-2 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                       <Users size={14} /> Контактна особа
                    </h4>
                    <div className="p-6 bg-zinc-950/30 rounded-3xl border border-white/5 space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-zinc-600 uppercase">ПІБ</p>
                        <p className="font-bold text-lg">{viewingOrder.name} {viewingOrder.surname}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-zinc-600 uppercase">Email</p>
                          <p className="text-zinc-400 text-sm flex items-center gap-2 truncate">
                            <Mail size={14} />
                            {viewingOrder.email}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-zinc-600 uppercase">Телефон</p>
                          <p className="text-zinc-400 text-sm flex items-center gap-2">
                            <Phone size={14} />
                            {viewingOrder.phone}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                       <Layout size={14} /> Деталі замовлення
                    </h4>
                    <div className="p-6 bg-zinc-950/30 rounded-3xl border border-white/5 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Подія:</span>
                        <span className="font-bold">{rawEvents.find(e => e.id === viewingOrder.eventId)?.title || viewingOrder.eventId}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Метод оплати:</span>
                        <span className="font-bold flex items-center gap-1.5">
                          Monobank / Карта <MonobankPawIcon />
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Тип квитка:</span>
                        <span className={cn(
                          "font-black uppercase text-[10px]",
                          viewingOrder.ticketType === 'vip' ? "text-purple-400" : viewingOrder.ticketType === 'free' ? "text-green-400" : "text-white"
                        )}>{viewingOrder.ticketType}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-white/5 pt-3 mt-3">
                        <span className="text-zinc-500 font-bold">Разом до сплати:</span>
                        <span className="font-black text-white text-lg">{viewingOrder.price} грн</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Квитки у замовленні ({viewingOrder.quantity || 1})</h4>
                  <div className="space-y-3">
                    {Array.from({ length: viewingOrder.quantity || 1 }).map((_, i) => {
                      const ticketSeqId = `${viewingOrder.id}-${i + 1}`;
                      const isScanned = viewingOrder.scannedTickets?.includes((i + 1).toString());
                      const isDownloading = individualDownloadingId === ticketSeqId;
                      const isQrOpen = expandedQrs.includes(ticketSeqId);

                      // Resolve seat details
                      const matchedElement = viewingOrderElements.find(el => el.id === viewingOrder.elementId);
                      let sectorStr = "Основний";
                      let seatStr = "FAN";
                      if (matchedElement) {
                        if (matchedElement.type === 'fanzone') {
                          sectorStr = "Фан-зона";
                          seatStr = matchedElement.label || "FAN";
                        } else if (matchedElement.type === 'table') {
                          sectorStr = `Столик ${matchedElement.label || ''}`;
                          seatStr = `Місце (Стіл)`;
                        } else if (matchedElement.type === 'seat') {
                          sectorStr = "Ряд / Секція";
                          seatStr = `Місце ${matchedElement.label || ''}`;
                        }
                      }

                      const isReturned = !!(viewingOrder.returnedCount && (i + 1) > (viewingOrder.quantity - viewingOrder.returnedCount));

                      return (
                        <div key={ticketSeqId} className={cn(
                          "p-5 rounded-[24px] border space-y-4 transition-all",
                          isReturned 
                            ? "bg-zinc-950/20 border-red-950/20 opacity-60" 
                            : "bg-zinc-950/40 border-white/5"
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center border",
                                isReturned ? "bg-red-900/10 border-red-500/20 text-red-500" :
                                isScanned ? "bg-red-500/10 border-red-500/20 text-red-100" : "bg-green-500/10 border-green-500/20 text-green-400"
                              )}>
                                <Ticket size={20} />
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className={cn("font-bold text-sm", isReturned ? "text-zinc-500 line-through" : "text-white")}>
                                    Квиток #{i + 1} - {viewingOrder.ticketType?.toUpperCase()}
                                  </span>
                                  {isReturned && (
                                    <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                      Повернено
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] text-zinc-400 font-bold uppercase">{sectorStr}: {seatStr}</span>
                                  <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                  <span className="text-[9px] text-zinc-500 font-mono">{ticketSeqId}</span>
                                </div>
                              </div>
                            </div>
 
                            <div className="flex items-center gap-2">
                              {isReturned ? (
                                <span className="text-[9px] font-black uppercase tracking-widest text-red-500/70 bg-red-500/5 border border-red-500/10 px-2.5 py-1 rounded-lg">Анульовано</span>
                              ) : (
                                <>
                                  {/* QR-code toggle button */}
                                  <button 
                                    onClick={() => toggleQr(ticketSeqId)}
                                    className={cn(
                                      "h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border",
                                      isQrOpen 
                                        ? "bg-purple-500/20 text-purple-400 border-purple-500/30" 
                                        : "bg-zinc-800 text-zinc-400 border-transparent hover:text-white"
                                    )}
                                  >
                                    {isQrOpen ? 'Сховати QR' : 'Показати QR'}
                                  </button>

                                  {/* Individual PDF download */}
                                  <button 
                                    disabled={isDownloading}
                                    onClick={() => handleDownloadIndividualTicket(ticketSeqId, i)}
                                    className="h-8 px-3 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-all text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {isDownloading ? (
                                      <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-white rounded-full animate-spin" />
                                    ) : (
                                      <Download size={12} />
                                    )}
                                    PDF
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
 
                          {/* Expandable active QR view */}
                          {!isReturned && isQrOpen && (
                            <div className="pt-4 border-t border-white/5 flex flex-col items-center justify-center animate-in slide-in-from-top-2 duration-200">
                              <div className="bg-white p-4 rounded-2xl inline-block shadow-xl">
                                <img 
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${viewingOrder.id}:${i + 1}`}
                                  alt="QR Code"
                                  className="w-[150px] h-[150px]"
                                />
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono mt-3 uppercase tracking-widest">
                                Квиток {i + 1} • {isScanned ? '🔴 Використано' : '🟢 Доступний'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                   <button className="flex flex-col items-center gap-2 p-4 bg-zinc-950/30 rounded-2xl border border-white/5 hover:bg-white/5 transition-all group">
                     <LinkIcon size={16} className="text-zinc-600 group-hover:text-purple-500" />
                     <span className="text-[8px] font-black uppercase text-zinc-500">Копіювати лінк</span>
                   </button>
                   <button className="flex flex-col items-center gap-2 p-4 bg-zinc-950/30 rounded-2xl border border-white/5 hover:bg-white/5 transition-all group">
                     <Mail size={16} className="text-zinc-600 group-hover:text-blue-500" />
                     <span className="text-[8px] font-black uppercase text-zinc-500">На пошту</span>
                   </button>
                   <button className="flex flex-col items-center gap-2 p-4 bg-zinc-950/30 rounded-2xl border border-white/5 hover:bg-white/5 transition-all group">
                     <Download size={16} className="text-zinc-600 group-hover:text-green-500" />
                     <span className="text-[8px] font-black uppercase text-zinc-500">Скачати PDF</span>
                   </button>
                   <button className="flex flex-col items-center gap-2 p-4 bg-zinc-950/30 rounded-2xl border border-white/5 hover:bg-white/5 transition-all group">
                     <RefreshCw size={16} className="text-zinc-600 group-hover:text-orange-500" />
                     <span className="text-[8px] font-black uppercase text-zinc-500">Друкувати</span>
                   </button>
                </div>
              </div>

              {/* Right Column: Status & History */}
              <div className="space-y-8">
                <div className="space-y-4 border-b border-white/5 pb-6">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Завантаження та Експорт</h4>
                  <button 
                      disabled={isOverallDownloadingPdf}
                      onClick={async () => {
                        if (isOverallDownloadingPdf) return;
                        setIsOverallDownloadingPdf(true);
                        try {
                          const event = rawEvents.find(e => e.id === viewingOrder.eventId);
                          if (!event) return;

                          const { getBase64ImageSafe, downloadTicketPDF } = await import('../services/pdfService');

                          let eventBase64Img = '';
                          if (event.imageUrl) {
                            eventBase64Img = await getBase64ImageSafe(event.imageUrl);
                          }

                          const qrCount = viewingOrder.quantity || 1;
                          const qrsBase64: string[] = [];
                          for (let i = 0; i < qrCount; i++) {
                            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${viewingOrder.id}:${i + 1}`;
                            const qrBase64 = await getBase64ImageSafe(qrUrl);
                            qrsBase64.push(qrBase64);
                          }

                          // We'll use a dynamic hidden element for capture
                          const tBg = config?.ticketBgColor || '#000000';
                          const tText = config?.ticketTextColor || '#ffffff';
                          const tAccent = config?.ticketAccentColor || '#a855f7';
                          const tBorder = config?.ticketBorderColor || '#27272a';
                          const tLogo = config?.ticketLogoUrl || config?.logoUrl || '';
                          const tMsg = config?.ticketMessage || "Будь ласка, пред'явіть цей квиток при вході.";

                          let ticketsHtml = '';
                          for (let i = 0; i < qrCount; i++) {
                            ticketsHtml += `<div style="background: rgba(255, 255, 255, 0.03); padding: 25px; border-radius: 24px; margin-bottom: 20px; border: 1px solid ${tBorder}; text-align: center;">` +
                              `<p style="font-size: 10px; color: ${tText}80; margin: 0 0 15px 0; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">КВИТОК ` + (i + 1) + ` З ` + qrCount + `</p>` +
                              '<div style="background: white; padding: 15px; border-radius: 20px; display: inline-block;">' +
                                '<img src="' + qrsBase64[i] + '" style="width: 200px; height: 200px; display: block;" />' +
                              '</div>' +
                              `<p style="font-family: monospace; font-size: 14px; font-weight: bold; margin: 15px 0 0 0; color: ${tAccent};">ID: ` + viewingOrder.id + '-' + (i + 1) + '</p>' +
                            '</div>';
                          }

                          const tempDiv = document.createElement('div');
                          tempDiv.id = 'temp-ticket-capture';
                          tempDiv.style.position = 'fixed';
                          tempDiv.style.left = '0';
                          tempDiv.style.top = '0';
                          tempDiv.style.zIndex = '-9999';
                          tempDiv.style.pointerEvents = 'none';
                          tempDiv.style.width = '600px';
                          tempDiv.innerHTML = `
                            <div style="font-family: sans-serif; background: ${tBg}; color: ${tText}; padding: 40px; text-align: center; border: 2px solid ${tBorder}; border-radius: 40px; width: 600px; box-sizing: border-box;">
                              ${tLogo ? `<img src="${tLogo}" style="max-height: 60px; object-fit: contain; margin: 0 auto 20px auto; display: block;" />` : ''}
                              ${eventBase64Img ? `<img src="${eventBase64Img}" style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 20px; margin-bottom: 30px;" />` : ''}
                              <h1 style="font-size: 32px; margin: 0 0 10px 0; font-weight: 900; text-transform: uppercase; color: ${tText};">${event.title}</h1>
                              <p style="font-size: 18px; color: ${tAccent}; margin-bottom: 30px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">
                                ${new Date(event.date).toLocaleString('uk-UA', { 
                                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                                })} | ${event.location}
                              </p>
                              <div style="background: rgba(255, 255, 255, 0.05); padding: 30px; border-radius: 24px; margin-bottom: 30px; text-align: left; border: 1px solid ${tBorder};">
                                <div style="margin-bottom: 20px;">
                                  <p style="font-size: 10px; color: ${tText}80; margin: 0; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">ВЛАСНИК</p>
                                  <p style="font-size: 24px; font-weight: 900; margin: 5px 0 0 0; color: ${tText};">${viewingOrder.name} ${viewingOrder.surname}</p>
                                </div>
                                <div>
                                  <p style="font-size: 10px; color: ${tText}80; margin: 0; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">ТИП КВИТКА</p>
                                  <p style="font-size: 20px; font-weight: 900; margin: 5px 0 0 0; color: ${tAccent};">${viewingOrder.ticketType.toUpperCase()}</p>
                                </div>
                              </div>

                              ${ticketsHtml}

                              <p style="font-size: 12px; color: ${tText}cc; text-transform: uppercase; letter-spacing: 1px; font-weight: 900; margin-top: 20px; max-width: 85%; margin-left: auto; margin-right: auto; line-height: 1.4;">${tMsg}</p>
                            </div>
                          `;
                          document.body.appendChild(tempDiv);
                          
                          const success = await downloadTicketPDF('temp-ticket-capture', viewingOrder.id);
                          document.body.removeChild(tempDiv);
                          
                          if (success) showMessage('success', 'PDF завантажено');
                          else showMessage('error', 'Помилка генерації PDF');
                        } catch (err) {
                          console.error('Error generating general PDF:', err);
                          showMessage('error', 'Помилка генерації PDF');
                        } finally {
                          setIsOverallDownloadingPdf(false);
                        }
                      }}
                      className="w-full py-4 bg-zinc-800 text-zinc-400 font-bold rounded-[20px] hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest disabled:opacity-50"
                    >
                      {isOverallDownloadingPdf ? (
                        <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      {isOverallDownloadingPdf ? 'Генерація PDF...' : 'Завантажити PDF'}
                    </button>
                  </div>

                  {/* Refund Tickets Section */}
                  {viewingOrder.status !== 'cancelled' && (
                    <div className="p-5 bg-zinc-950/30 rounded-3xl border border-white/5 space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <RotateCcw size={14} className="text-red-400" /> Повернення квитків
                      </h4>
                      
                      {(() => {
                        const availableCount = viewingOrder.quantity - (viewingOrder.returnedCount || 0);
                        if (availableCount <= 0) {
                          return (
                            <p className="text-xs text-red-400 font-bold">Всі квитки вже повернуто.</p>
                          );
                        }

                        const unitPrice = Math.floor(viewingOrder.price / viewingOrder.quantity);
                        const refundSum = Math.ceil(unitPrice * refundCount);

                        return (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-zinc-500 uppercase">Кількість квитків для повернення:</label>
                              <div className="flex items-center gap-2">
                                <select
                                  value={refundCount}
                                  onChange={(e) => setRefundCount(Number(e.target.value))}
                                  className="flex-1 h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs focus:ring-2 focus:ring-purple-500 outline-none text-white font-bold"
                                >
                                  {Array.from({ length: availableCount }).map((_, idx) => (
                                    <option key={idx + 1} value={idx + 1}>
                                      {idx + 1} шт. (доступно: {availableCount})
                                    </option>
                                  ))}
                                </select>
                                <div className="text-right whitespace-nowrap bg-zinc-900 px-3 h-10 flex items-center rounded-xl border border-zinc-800">
                                  <span className="text-xs text-red-400 font-black">{refundSum} грн</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-zinc-500 uppercase flex items-center gap-1">
                                ID інвойсу Monobank <span className="text-zinc-650">(для авто-повернення коштів)</span>
                              </label>
                              <input
                                type="text"
                                value={refundInvoiceId}
                                onChange={(e) => setRefundInvoiceId(e.target.value)}
                                placeholder="Вкажіть ID інвойсу, або залиште пустим"
                                className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs focus:ring-2 focus:ring-purple-500 outline-none text-white font-mono"
                              />
                            </div>

                            <button
                              disabled={isRefunding}
                              onClick={async () => {
                                if (confirm(`Ви дійсно бажаєте повернути квитків: ${refundCount} шт. на суму ${refundSum} грн?${refundInvoiceId && privateSettings?.monobankToken ? '\n\nКошти буде автоматично повернено клієнту на карту.' : ''}`)) {
                                  await handleTicketRefund(viewingOrder, refundCount, refundInvoiceId);
                                }
                              }}
                              className="w-full h-11 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest disabled:opacity-50"
                            >
                              {isRefunding ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <RotateCcw size={14} />
                              )}
                              {isRefunding ? 'Опрацювання...' : 'Підтвердити повернення'}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Історія дій</h4>
                  <div className="space-y-5 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-800">
                    <div className="relative pl-10 space-y-1">
                      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-zinc-500" />
                      </div>
                      <p className="text-xs font-bold">Створено замовлення</p>
                      <p className="text-[9px] text-zinc-500 uppercase">{new Date(viewingOrder.createdAt || 0).toLocaleString()}</p>
                    </div>
                    {viewingOrder.status === 'paid' && (
                      <div className="relative pl-10 space-y-1">
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                        </div>
                        <p className="text-xs font-bold">Статус змінено на "Сплачено"</p>
                        <p className="text-[9px] text-zinc-500 uppercase">Синхронізовано з Monobank</p>
                      </div>
                    )}
                    {viewingOrder.returnedCount !== undefined && viewingOrder.returnedCount > 0 && (
                      <div className="relative pl-10 space-y-1">
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        </div>
                        <p className="text-xs font-bold text-red-400">Повернуто квитків: {viewingOrder.returnedCount} шт.</p>
                        <p className="text-[9px] text-zinc-500 uppercase">
                          {viewingOrder.monobankInvoiceId ? "Автоматичне повернення Monobank" : "Ручне повернення"}
                        </p>
                      </div>
                    )}
                    {viewingOrder.scannedTickets && viewingOrder.scannedTickets.map((ticketNum) => {
                      const scanTime = viewingOrder.scannedAtTimes?.[ticketNum] || viewingOrder.scannedAt || new Date().toISOString();
                      return (
                        <div key={ticketNum} className="relative pl-10 space-y-1">
                          <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                          </div>
                          <p className="text-xs font-bold text-white">Проскановано квиток #{viewingOrder.id}-{ticketNum}</p>
                          <p className="text-[9px] text-zinc-500 uppercase">Вхід дозволено • {new Date(scanTime).toLocaleString('uk-UA')}</p>
                        </div>
                      );
                    })}
                    {viewingOrder.scannedCount > 0 && (!viewingOrder.scannedTickets || viewingOrder.scannedTickets.length === 0) && (
                      <div className="relative pl-10 space-y-1">
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-purple-500" />
                        </div>
                        <p className="text-xs font-bold">Квиток проскановано ({viewingOrder.scannedCount})</p>
                        <p className="text-[9px] text-zinc-500 uppercase">Вхід дозволено • {viewingOrder.scannedAt ? new Date(viewingOrder.scannedAt).toLocaleString('uk-UA') : ''}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditingPrivate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsEditingPrivate(false)} />
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl p-8">
            <h3 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2">
              <SettingsIcon size={20} className="text-purple-500" />
              Приватні Ключі
            </h3>
            <form onSubmit={handleSavePrivate} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1 flex items-center gap-1">
                    Monobank Token <MonobankPawIcon />
                  </label>
                  <input 
                    type="password"
                    value={tempPrivate.monobankToken || ''}
                    onChange={e => setTempPrivate({...tempPrivate, monobankToken: e.target.value})}
                    placeholder="Ваш токен monobank"
                    className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">SMTP Email (sender)</label>
                  <input 
                    type="text"
                    value={tempPrivate.smtpUser || ''}
                    onChange={e => setTempPrivate({...tempPrivate, smtpUser: e.target.value})}
                    placeholder="sky.party@ukr.net"
                    className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">SMTP Password (ukr.net)</label>
                  <input 
                    type="password"
                    value={tempPrivate.smtpPass || ''}
                    onChange={e => setTempPrivate({...tempPrivate, smtpPass: e.target.value})}
                    placeholder="Пароль для зовнішніх додатків"
                    className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Telegram Bot Token</label>
                  <input 
                    type="password"
                    value={tempPrivate.telegramBotToken || ''}
                    onChange={e => setTempPrivate({...tempPrivate, telegramBotToken: e.target.value})}
                    placeholder="Токен Telegram бота"
                    className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Telegram Chat ID</label>
                  <input 
                    type="text"
                    value={tempPrivate.telegramChatId || ''}
                    onChange={e => setTempPrivate({...tempPrivate, telegramChatId: e.target.value})}
                    placeholder="Chat ID (наприклад -100xxxxxxxxxx)"
                    className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsEditingPrivate(false)}
                  className="flex-1 h-14 rounded-2xl font-bold bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Скасувати
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-white text-black h-14 rounded-2xl font-bold hover:bg-zinc-200 transition-colors"
                >
                  Зберегти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {issuingFreeTicketData?.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setIssuingFreeTicketData(null)} />
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl p-8 space-y-6 text-white text-left z-20">
            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              <Ticket className="text-purple-500" size={24} />
              Видати Квиток
            </h3>
            
            <div className="space-y-4">
              {/* Event selection if issuing manual general ticket without an element */}
              {!issuingFreeTicketData.element && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Виберіть Подію</label>
                  <select
                    value={issuingFreeTicketData.eventId || ''}
                    onChange={e => setIssuingFreeTicketData({...issuingFreeTicketData, eventId: e.target.value})}
                    className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none text-white text-sm"
                  >
                    <option value="">-- Виберіть Подію --</option>
                    {rawEvents.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ticket Type if manual general ticket */}
              {!issuingFreeTicketData.element && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Тип Квитка</label>
                  <select
                    value={issuingFreeTicketData.ticketType}
                    onChange={e => setIssuingFreeTicketData({...issuingFreeTicketData, ticketType: e.target.value as any})}
                    className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none text-white text-sm"
                  >
                    <option value="standard">🎫 Standard</option>
                    <option value="vip">👑 VIP</option>
                    <option value="free">🎁 Complimentary (Free)</option>
                  </select>
                </div>
              )}

              {/* Seat info if there is one */}
              {issuingFreeTicketData.element && (
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-xs space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Елемент на Схемі</p>
                  <p className="text-sm font-black text-white">{issuingFreeTicketData.element.type === 'fanzone' ? 'Фан-зона' : issuingFreeTicketData.element.type === 'table' ? 'Стіл' : 'Місце'} : {issuingFreeTicketData.element.label}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Email отримувача</label>
                <input 
                  type="email"
                  required
                  value={issuingFreeTicketData.email}
                  onChange={e => setIssuingFreeTicketData({...issuingFreeTicketData, email: e.target.value})}
                  placeholder="name@gmail.com"
                  className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Ім'я</label>
                  <input 
                    type="text"
                    value={issuingFreeTicketData.name}
                    onChange={e => setIssuingFreeTicketData({...issuingFreeTicketData, name: e.target.value})}
                    placeholder="Іван"
                    className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none text-sm text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Прізвище</label>
                  <input 
                    type="text"
                    value={issuingFreeTicketData.surname}
                    onChange={e => setIssuingFreeTicketData({...issuingFreeTicketData, surname: e.target.value})}
                    placeholder="Петренко"
                    className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none text-sm text-white"
                  />
                </div>
              </div>

              {/* Quantity input only if fanzone or general manual ticket */}
              {(!issuingFreeTicketData.element || issuingFreeTicketData.element.type === 'fanzone') && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1 font-sans">Кількість квитків</label>
                  <input 
                    type="number"
                    min="1"
                    value={issuingFreeTicketData.quantity}
                    onChange={e => setIssuingFreeTicketData({...issuingFreeTicketData, quantity: parseInt(e.target.value) || 1})}
                    className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono text-white"
                  />
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-3">
              <button 
                type="button" 
                onClick={() => setIssuingFreeTicketData(null)}
                className="flex-1 h-14 rounded-2xl font-bold bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm text-white"
              >
                Скасувати
              </button>
              <button 
                type="button"
                onClick={submitFreeTicketFromModal}
                disabled={!issuingFreeTicketData.email.trim() || (!issuingFreeTicketData.element && !issuingFreeTicketData.eventId)}
                className="flex-1 bg-white text-black h-14 rounded-2xl font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Видати
              </button>
            </div>
          </div>
        </div>
      )}

      {editingChart && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black">
          <SeatingChartEditor 
            initialElements={editingChart.elements ? (typeof editingChart.elements === 'string' ? JSON.parse(editingChart.elements || '[]') : editingChart.elements) : []}
            initialBackground={editingChart.backgroundImage}
            onSave={(elements, bg) => handleSaveChart(elements, bg)}
            onCancel={() => setEditingChart(null)}
          />
        </div>
      )}

      {showAdminMapSelector && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 text-white select-none">
          {/* Header */}
          <div className="h-20 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowAdminMapSelector(false)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white"
              >
                <X size={20} />
              </button>
              <div>
                 <h2 className="text-xl font-bold uppercase tracking-tight text-white">Візуальний квотер та видача через схему</h2>
                 <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                   Виберіть подію та клікніть на столи чи фан-зону для налаштування квот та видачі квитків
                 </p>
              </div>
            </div>

            {/* Event selector dropdown */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-zinc-400">Подія:</span>
              <select 
                value={adminSelectedEventId}
                onChange={(e) => handleSelectAdminEvent(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide outline-none w-72 focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- Оберіть подію --</option>
                {rawEvents.map(e => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            {isAdminMapLoading ? (
              <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Завантаження схеми та завантаженості...</p>
              </div>
            ) : null}

            {/* Canvas Container */}
            <div className="flex-1 bg-[#050505] relative overflow-hidden flex items-center justify-center p-8">
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-[15vw] font-black text-white/[0.01] select-none tracking-tighter">
                QUOTA
              </div>
              
              {/* Zoom controls */}
              <div className="absolute bottom-12 left-12 flex flex-col gap-3 z-10">
                <button 
                  onClick={() => setAdminMapScale(prev => Math.min(prev * 1.2, 5))}
                  className="w-12 h-12 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-white/50 hover:text-white hover:bg-zinc-800 transition-all shadow-2xl"
                  title="Наблизити"
                >
                  <Plus size={20} />
                </button>
                <button 
                  onClick={() => setAdminMapScale(prev => Math.max(prev / 1.2, 0.2))}
                  className="w-12 h-12 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-white/50 hover:text-white hover:bg-zinc-800 transition-all shadow-2xl"
                  title="Віддалити"
                >
                  {/* use standard minus representation */}
                  <b className="text-xl font-normal select-none mb-1">-</b>
                </button>
                <button 
                  onClick={() => setAdminMapScale(1)}
                  className="w-12 h-12 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-white/50 hover:text-white hover:bg-zinc-800 transition-all shadow-2xl"
                  title="Скинути"
                >
                  <Maximize size={20} />
                </button>
              </div>

              {adminSelectedEventId ? (
                adminChartElements.length > 0 ? (
                  <div className="w-full max-w-[900px] aspect-square bg-[#0a0a0a] rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden p-8 flex items-center justify-center">
                    <SeatingChartCanvas 
                      elements={adminChartElements}
                      backgroundImage={charts.find(c => c.id === rawEvents.find(e => e.id === adminSelectedEventId)?.chartId)?.backgroundImage}
                      occupiedIds={orders
                        .filter(o => o.eventId === adminSelectedEventId && (o.status === 'paid' || o.status === 'pending') && o.elementId)
                        .map(o => o.elementId!)}
                      selectedId={adminSelectedElement?.id || null}
                      onSelect={(id) => {
                        const el = adminChartElements.find(e => e.id === id);
                        setAdminSelectedElement(el || null);
                      }}
                      width={1000}
                      height={800}
                      scale={adminMapScale}
                      onScaleChange={setAdminMapScale}
                      isAdmin={false} // Click-to-select mode, not edit-drag mode
                      isSelectableAll={true}
                    />
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 mx-auto">
                      <Grid3X3 size={32} />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">У цієї події немає прикріпленої схеми залу</p>
                  </div>
                )
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 mx-auto">
                    <Grid3X3 size={32} />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Будь ласка, оберіть подію в меню справа вгорі</p>
                </div>
              )}
            </div>

            {/* Info and action panel */}
            <div className="w-96 border-l border-white/5 bg-zinc-900/30 p-10 flex flex-col gap-10 overflow-y-auto shrink-0 bg-zinc-950/40">
              <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-600">Панель керування елементом</h3>
                
                {adminSelectedElement ? (
                  <div className="space-y-8">
                    <div className="p-8 bg-white/5 rounded-3xl border border-white/10 space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                          <Ticket size={32} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 capitalize">{adminSelectedElement.type === 'fanzone' ? 'Фан-зона' : adminSelectedElement.type === 'table' ? 'Стіл' : 'Місце'}</p>
                          <h4 className="text-2xl font-bold text-white">{adminSelectedElement.label || 'Без назви'}</h4>
                        </div>
                      </div>

                      {/* Display Occupancy details & current quotas */}
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-zinc-400">Продано квитків:</span>
                          <span className="text-xs font-bold font-mono py-1 px-2.5 bg-zinc-800 rounded-lg text-white">
                            {orders.filter(o => o.eventId === adminSelectedEventId && o.elementId === adminSelectedElement.id && (o.status === 'paid' || o.status === 'used')).reduce((sum, o) => sum + (o.quantity || 1), 0)}
                          </span>
                        </div>

                        {adminSelectedElement.type === 'fanzone' && (
                          <div key={adminSelectedElement.id} className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-zinc-400">Поточна квота (місткість):</span>
                              <span className="text-xs font-bold text-green-400 font-mono">
                                {adminSelectedElement.capacity || 0} осіб
                              </span>
                            </div>

                            {/* FANZON QUOTA ADJUSTER ('квотувати фан зону') */}
                            <div className="space-y-2 pt-2 border-t border-white/5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Встановити квоту фан-зони</label>
                              <div className="flex gap-2">
                                <input 
                                  type="number"
                                  id="fanzone-quota-input"
                                  defaultValue={adminSelectedElement.capacity || ''}
                                  placeholder="Кількість..."
                                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none text-white font-mono"
                                />
                                <button 
                                  onClick={() => {
                                    const input = document.getElementById('fanzone-quota-input') as HTMLInputElement;
                                    if (input) {
                                      const cap = parseInt(input.value) || 0;
                                      handleUpdateFanzoneCapacity(adminSelectedElement.id, cap);
                                    }
                                  }}
                                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] uppercase tracking-wider px-3 rounded-xl transition-all"
                                >
                                  Зберегти
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Quota Button for Seat / Table to remove from sale */}
                        {(adminSelectedElement.type === 'table' || adminSelectedElement.type === 'seat') && (
                          <div className="space-y-3 pt-3 border-t border-white/5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-zinc-400">Продаж:</span>
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                                adminSelectedElement.isBlocked 
                                  ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                                  : "bg-green-500/10 text-green-400 border border-green-500/20"
                              )}>
                                {adminSelectedElement.isBlocked ? 'Знято з продажу' : 'У продажу'}
                              </span>
                            </div>

                            <button 
                              onClick={() => handleToggleBlockElement(adminSelectedElement.id, !!adminSelectedElement.isBlocked)}
                              className={cn(
                                "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                                adminSelectedElement.isBlocked
                                  ? "bg-emerald-600/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/20"
                                  : "bg-red-600/10 border-red-500/20 text-red-500 hover:bg-red-600/20"
                              )}
                            >
                              {adminSelectedElement.isBlocked ? '🔓 Квота: Повернути в продаж' : '🔒 Квота: Зняти з продажу'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Issue Complimentary (Free) ticket */}
                    <button 
                      onClick={() => handleIssueFreeTicketForElement(adminSelectedElement)}
                      className="w-full py-4 bg-white hover:bg-zinc-200 text-black rounded-[24px] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-white/5"
                    >
                      🎫 Видати безплатний квиток
                    </button>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-4 border border-dashed border-white/5 rounded-3xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-650 text-zinc-500">Клікніть на стіл, фан-зону чи місце на схемі, щоб налаштувати квоту або видати безплатні квитки</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
