import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { getFbFirestore, getFbAuth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { Event, SiteConfig, Order, PrivateSettings, Chart, ChartElement } from '../types';

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
  logoUrl: '',
  instagramUrl: 'https://instagram.com/sky_party_kyiv',
  telegramUrl: 'https://t.me/sky_party_kyiv',
  facebookUrl: 'https://facebook.com/skypartykyiv',
  bannerTitle: 'SKY PARTY',
  footerText: 'SKY PARTY — ТВОЄ НЕБО, ТВОЯ ВЕЧІРКА.',
  noEventsMessage: 'Зараз немає актуальних подій',
  aboutText: `Sky Party — це не просто серія вечірок, це новий рівень нічного життя. Ми об'єднуємо кращих артистів, сучасне світлове шоу та неповторну атмосферу, щоб створювати спогади, які залишаються назавжди.\n\nНаша місія — дарувати емоції через якісний звук та візуальне мистецтво. Кожна подія продумана до найдрібніших деталей, від вибору локації до коктейльної карти.`,
  contactEmail: 'info@skyparty.ua',
  contactAddress: 'м. Київ, вул. Паркова, 12',
  primaryColor: '#a855f7'
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
  const [charts, setCharts] = useState<Chart[]>([]);
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
    if (!firestore) return [];
    try {
      const { getDocs, collection: fbCollection } = await import('firebase/firestore');
      const snapshot = await getDocs(fbCollection(firestore, 'charts', chartId, 'elements'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChartElement[];
    } catch (err) {
      console.error('Error loading chart elements:', err);
      return [];
    }
  }, [firestore]);

  const effectiveConfig = config || (isInitialized ? DEFAULT_CONFIG : null);
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
          setCharts(chartsData);
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, 'charts');
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
