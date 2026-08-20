import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { getFbFirestore, getFbAuth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { Event, SiteConfig, Order, PrivateSettings, Chart, ChartElement } from '../types';
import { ZOSYNA_CHART_ID, ZOSYNA_CHART_NAME, ZOSYNA_ELEMENTS, ZOSYNA_PRESET_CHART } from '../data/zosynaPreset';

interface AppContextType {
  events: Event[];
  rawEvents: Event[];
  charts: Chart[];
  config: SiteConfig | null;
  loading: boolean;
  isAdmin: boolean;
  setAdmin: (val: boolean) => void;
  isInitialized: boolean;
  orders: Order[];
  privateSettings: PrivateSettings | null;
  loadChartElements: (chartId: string) => Promise<ChartElement[]>;
  showAbout: boolean;
  setShowAbout: (val: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_CONFIG: SiteConfig = {
  logoUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='500' height='500'%3E%3Cdefs%3E%3ClinearGradient id='gold-grad-p' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23fff4cc' /%3E%3Cstop offset='30%25' stop-color='%23e1ba42' /%3E%3Cstop offset='70%25' stop-color='%23b88314' /%3E%3Cstop offset='100%25' stop-color='%23fff4cc' /%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='none' stroke='url(%23gold-grad-p)' stroke-width='1.2' /%3E%3Ccircle cx='50' cy='50' r='41.5' fill='none' stroke='url(%23gold-grad-p)' stroke-width='0.6' stroke-dasharray='1 1' opacity='0.8' /%3E%3Cg transform='translate(41, 18) scale(0.4)'%3E%3Cpath d='M 6 14 A 5 5 0 0 1 15 9 A 7 7 0 0 1 31 11 A 5 5 0 0 1 34 19 A 3 3 0 0 1 31 22 L 9 22 A 3 3 0 0 1 6 14 Z' fill='none' stroke='url(%23gold-grad-p)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' /%3E%3Cpath d='M 33,5 L 34.5,8 L 37.5,8.3 L 35.2,10.6 L 36,13.8 L 33,12.2 L 30,13.8 L 30.8,10.6 L 28.5,8.3 L 31.5,8 Z' fill='url(%23gold-grad-p)' /%3E%3C/g%3E%3Ctext x='50' y='52' fill='url(%23gold-grad-p)' font-family='sans-serif' font-weight='900' font-size='11' letter-spacing='0.18em' text-anchor='middle'%3ESKY%3C/text%3E%3Ctext x='50' y='65' fill='url(%23gold-grad-p)' font-family='sans-serif' font-weight='900' font-size='11' letter-spacing='0.14em' text-anchor='middle'%3EPARTY%3C/text%3E%3C/svg%3E",
  instagramUrl: 'https://instagram.com/sky_party_kyiv',
  telegramUrl: 'https://t.me/sky_party_kyiv',
  facebookUrl: 'https://facebook.com/skypartykyiv',
  bannerTitle: 'SKY PARTY',
  footerText: 'SKY PARTY — ТВОЄ НЕБО, ТВОЯ ВЕЧІРКА.',
  noEventsMessage: 'Зараз немає актуальних подій',
  aboutText: `Sky Party — це не просто серія вечірок, а новий рівень нічного життя та твій унікальний вимір нічних івентів. Ми об'єднуємо кращих артистів, сучасне світлове шоу та неповторну атмосферу, щоб створити незабутні спогади, що залишаються назавжди.\n\nНаша місія — дарувати емоції через преміальний звук та візуальне мистецтво. Кожна подія продумана до найдрібніших деталей, від вибору унікальної локації до коктейльної карти.`,
  contactEmail: 'info@skyparty.ua',
  contactAddress: 'м. Київ, вул. Паркова, 12',
  primaryColor: '#a855f7',
  siteUrl: ''
};

const MOCK_EVENTS: Event[] = [
  {
    id: 'mock-1',
    title: 'SKY PARTY: OPEN AIR',
    description: 'Найкраща вечірка літа. Танці під відкритим небом, коктейлі та неймовірна атмосфера.',
    date: '15 Червня, 20:00',
    location: 'Київ, SKY GARDEN',
    price: '500',
    vipPrice: '1500',
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80',
    ticketLink: '#',
    isActive: true,
    createdAt: Date.now()
  }
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [charts, setCharts] = useState<Chart[]>([ZOSYNA_PRESET_CHART]);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setAdminState] = useState(() => {
    return sessionStorage.getItem('sky_admin') === 'true';
  });
  const [showAbout, setShowAbout] = useState(false);

  const setAdmin = (val: boolean) => {
    setAdminState(val);
    if (val) {
      sessionStorage.setItem('sky_admin', 'true');
    } else {
      sessionStorage.removeItem('sky_admin');
    }
  };
  const [isInitialized, setIsInitialized] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [privateSettings, setPrivateSettings] = useState<PrivateSettings | null>(null);
  const firestore = getFbFirestore();

  const loadChartElements = useCallback(async (chartId: string) => {
    if (chartId === ZOSYNA_CHART_ID || chartId === 'zosyna' || chartId.toLowerCase() === 'зосина') {
      if (!firestore) return ZOSYNA_ELEMENTS;
      try {
        const { getDocs, collection: fbCollection } = await import('firebase/firestore');
        const snapshot = await getDocs(fbCollection(firestore, 'charts', chartId, 'elements'));
        if (snapshot.docs.length > 0) {
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChartElement[];
        }
        return ZOSYNA_ELEMENTS;
      } catch (err) {
        return ZOSYNA_ELEMENTS;
      }
    }

    if (!firestore) return [];
    try {
      const { getDocs, collection: fbCollection } = await import('firebase/firestore');
      const snapshot = await getDocs(fbCollection(firestore, 'charts', chartId, 'elements'));
      if (snapshot.docs.length > 0) {
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChartElement[];
      }
      return [];
    } catch (err) {
      console.error('Error loading chart elements:', err);
      return [];
    }
  }, [firestore]);

  const effectiveConfig = isInitialized
    ? {
        ...DEFAULT_CONFIG,
        ...config,
        logoUrl: (config?.logoUrl && config.logoUrl.trim() !== '') ? config.logoUrl : DEFAULT_CONFIG.logoUrl,
        aboutText: (config?.aboutText && config.aboutText.trim() !== '') ? config.aboutText : DEFAULT_CONFIG.aboutText
      }
    : null;
  const effectiveEvents = events.filter(e => {
    if (!e.endDate) return true;
    return e.endDate > Date.now();
  });

  useEffect(() => {
    const root = document.documentElement;
    if (effectiveConfig?.primaryColor) {
      root.style.setProperty('--neon-purple', effectiveConfig.primaryColor);
    } else {
      root.style.setProperty('--neon-purple', '#a855f7');
    }
  }, [effectiveConfig?.primaryColor]);

  useEffect(() => {
    let unsubscribeEvents: () => void;
    let unsubscribeCharts: () => void;
    let unsubscribeConfig: () => void;
    let unsubscribeOrders: () => void;
    let unsubscribePrivate: () => void;

    const init = async () => {
      try {
        const db = getFbFirestore();
        if (!db) {
          console.warn('Firebase not initialized. Using mock data.');
          setEvents(MOCK_EVENTS);
          setConfig(DEFAULT_CONFIG);
          return;
        }
        
        // Listen to events
        const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
        unsubscribeEvents = onSnapshot(q, (snapshot) => {
          const eventsData = snapshot.docs.map(doc => {
            const data = doc.data();
            // Convert Firestore Timestamp to number (ms)
            let createdAt = data.createdAt;
            if (createdAt && typeof createdAt === 'object' && 'toMillis' in createdAt) {
              createdAt = createdAt.toMillis();
            } else if (typeof createdAt !== 'number') {
              createdAt = Date.now();
            }

            return {
              id: doc.id,
              ...data,
              createdAt
            };
          }) as Event[];
          
          setEvents(eventsData);
          setLoading(false);
          setIsInitialized(true);
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, 'events');
          setLoading(false);
          setIsInitialized(true);
        });

        // Listen to charts
        const chartsQuery = query(collection(db, 'charts'), orderBy('createdAt', 'desc'));
        unsubscribeCharts = onSnapshot(chartsQuery, (snapshot) => {
          const chartsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Chart[];
          
          const hasZosyna = chartsData.some(c => c.id === ZOSYNA_CHART_ID || c.name?.toLowerCase().includes('зосина') || c.name?.toLowerCase().includes('zosyna'));
          if (!hasZosyna) {
            setCharts([ZOSYNA_PRESET_CHART, ...chartsData]);
          } else {
            setCharts(chartsData);
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, 'charts');
          setCharts([ZOSYNA_PRESET_CHART]);
        });

        // Listen to config
        unsubscribeConfig = onSnapshot(doc(db, 'config', 'settings'), (snapshot) => {
          if (snapshot.exists()) {
            setConfig(snapshot.data() as SiteConfig);
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'config/settings');
        });

        // Listen to orders
        unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
          const ordersData = snapshot.docs.map(doc => {
            const data = doc.data();
            let createdAt = data.createdAt;
            if (createdAt && typeof createdAt === 'object' && 'toMillis' in createdAt) {
              createdAt = createdAt.toMillis();
            }
            return { id: doc.id, ...data, createdAt } as Order;
          });
          setOrders(ordersData);
        });

        // Listen to private settings
        unsubscribePrivate = onSnapshot(doc(db, 'settings', 'private'), (snapshot) => {
          if (snapshot.exists()) {
            setPrivateSettings(snapshot.data() as PrivateSettings);
          }
        });

      } catch (err) {
        console.warn('Initialization error.', err);
      }
    };

    init();

    return () => {
      if (unsubscribeEvents) unsubscribeEvents();
      if (unsubscribeCharts) unsubscribeCharts();
      if (unsubscribeConfig) unsubscribeConfig();
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribePrivate) unsubscribePrivate();
    };
  }, []);

  return (
    <AppContext.Provider value={{ 
      events: effectiveEvents, 
      rawEvents: events,
      charts,
      config: effectiveConfig, 
      loading, 
      isAdmin, 
      setAdmin,
      isInitialized,
      orders,
      privateSettings,
      loadChartElements,
      showAbout,
      setShowAbout
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
