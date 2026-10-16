import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import MaterialIcon from '../components/MaterialIcon';

const Send = ({ className }: { className?: string }) => <MaterialIcon name="send" className={className} />;
const ShieldAlert = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const Sparkles = ({ className }: { className?: string }) => <MaterialIcon name="psychology" className={className} />;
const Loader = ({ className }: { className?: string }) => <MaterialIcon name="loader" className={`animate-spin ${className}`} />;
const Brain = ({ className }: { className?: string }) => <MaterialIcon name="neurology" className={className} />;
const Trash2 = ({ className }: { className?: string }) => <MaterialIcon name="delete" className={className} />;
const Languages = ({ className }: { className?: string }) => <MaterialIcon name="language" className={className} />;
const Mic = ({ className }: { className?: string }) => <MaterialIcon name="mic" className={className} />;
const MicOff = ({ className }: { className?: string }) => <MaterialIcon name="mic_off" className={className} />;
const Volume2 = ({ className }: { className?: string }) => <MaterialIcon name="volume_up" className={className} />;
const VolumeX = ({ className }: { className?: string }) => <MaterialIcon name="volume_off" className={className} />;
const Copy = ({ className }: { className?: string }) => <MaterialIcon name="content_copy" className={className} />;
const Edit3 = ({ className }: { className?: string }) => <MaterialIcon name="edit" className={className} />;
const Star = ({ className, fill }: { className?: string; fill?: string | boolean }) => <MaterialIcon name="star" className={className} fill={!!fill} />;
const Plus = ({ className }: { className?: string }) => <MaterialIcon name="add" className={className} />;
const Search = ({ className }: { className?: string }) => <MaterialIcon name="search" className={className} />;
const ThumbsUp = ({ className }: { className?: string }) => <MaterialIcon name="thumb_up" className={className} />;
const ThumbsDown = ({ className }: { className?: string }) => <MaterialIcon name="thumb_down" className={className} />;
const Download = ({ className }: { className?: string }) => <MaterialIcon name="download" className={className} />;
const Activity = ({ className }: { className?: string }) => <MaterialIcon name="analytics" className={className} />;
const HeartPulse = ({ className }: { className?: string }) => <MaterialIcon name="monitoring" className={className} />;
const Paperclip = ({ className }: { className?: string }) => <MaterialIcon name="attach_file" className={className} />;
const Settings = ({ className }: { className?: string }) => <MaterialIcon name="settings" className={className} />;
const X = ({ className }: { className?: string }) => <MaterialIcon name="close" className={className} />;
const StopCircle = ({ className }: { className?: string }) => <MaterialIcon name="stop_circle" className={className} />;
const Share2 = ({ className }: { className?: string }) => <MaterialIcon name="share" className={className} />;
const RefreshCw = ({ className }: { className?: string }) => <MaterialIcon name="refresh" className={className} />;
const Play = ({ className }: { className?: string }) => <MaterialIcon name="play_arrow" className={className} />;
const Pause = ({ className }: { className?: string }) => <MaterialIcon name="pause" className={className} />;
const Sun = ({ className }: { className?: string }) => <MaterialIcon name="light_mode" className={className} />;
const Moon = ({ className }: { className?: string }) => <MaterialIcon name="dark_mode" className={className} />;
const Upload = ({ className }: { className?: string }) => <MaterialIcon name="upload" className={className} />;
const Database = ({ className }: { className?: string }) => <MaterialIcon name="database" className={className} />;
import { useToastContext } from '../hooks/useToastContext';
import { useAuth } from '../hooks/useAuth';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { useDarkMode } from '../hooks/useDarkMode';
import { useNotifications } from '../contexts/NotificationContext';
import { useLanguage } from '../hooks/useLanguage';
import { ContentCard, SectionHeading } from '../components/Ui';
import ProfileAvatar from '../components/ProfileAvatar';
import SkeletonLoader from '../components/SkeletonLoader';
import { apiClient, getAccessToken } from '../services/apiClient';
import { fetchLatestAnalysis } from '../services/mriService';
import { fetchPatientProfile } from '../services/profileService';
import { fetchUserSettings, updateUserSettings, type UserSettings as DbUserSettings } from '../services/settingsService';
import type { PredictionResult } from '../types/mri-workflow';
import type { PatientProfile } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  feedback?: boolean | null;
  responseTime?: number | null;
  model?: string | null;
  tokensUsed?: number | null;
  timestamp?: string;
  fileName?: string | null;
  fileType?: string | null;
}

interface ChatHistoryItem {
  id: string;
  scanId?: string | null;
  patientId?: string | null;
  sessionId?: string | null;
  question: string;
  answer?: string | null;
  language?: string | null;
  responseTime?: number | null;
  model?: string | null;
  tokensUsed?: number | null;
  feedback?: boolean | null;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  scan_id?: string | null;
  patient_id?: string | null;
  is_archived: boolean;
  is_favorite: boolean;
  language?: string | null;
  created_at: string;
  updated_at: string;
}

type ChatLanguage = 'English' | 'Telugu' | 'Hindi';

type AssistantRouteState = {
  scanContext?: {
    patient?: {
      name?: string;
      id?: string;
      age?: number;
      gender?: string;
      bloodGroup?: string;
    };
    prediction?: string;
    confidence?: number;
    riskScore?: number;
    riskLevel?: string;
    probabilities?: Record<string, number>;
    recommendations?: Record<string, string[]>;
    scanId?: string;
    reportId?: string;
  };
} | null;

const chatLanguages: ChatLanguage[] = ['English', 'Telugu', 'Hindi'];

function getOfflineFallbackResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('prevent') || q.includes('avoid') || q.includes('progression')) {
    return `### 🛡️ Clinical Guidelines: Dementia Progression Prevention
[OFFLINE DIAGNOSTIC KB FALLBACK]

Based on localized medical guidelines, here are the key steps to support neurological health and mitigate progression:
1. **Regular Cognitive Engagement**: Encourage puzzles, reading, social interaction, and brain-stimulating hobbies.
2. **Physical Exercise**: At least 150 minutes of moderate aerobic activity weekly to stimulate cerebral blood flow.
3. **Cardiovascular Health**: Rigorously manage hypertension, diabetes, and hyperlipidemia, as vascular risk factors directly accelerate cognitive decline.
4. **Sleep Quality**: Ensure 7-8 hours of uninterrupted sleep to facilitate glymphatic brain clearance of toxic plaques.`;
  }

  if (q.includes('treat') || q.includes('medicat') || q.includes('donepezil') || q.includes('medicine')) {
    return `### 💊 Clinical Pharmacotherapy & Dementia Management
[OFFLINE DIAGNOSTIC KB FALLBACK]

Under standard clinical pathways for cognitive disorders:
1. **Cholinesterase Inhibitors**: Medications like *Donepezil*, *Rivastigmine*, or *Galantamine* are frequently indicated for mild-to-moderate stages to enhance synaptic transmission.
2. **NMDA Receptor Antagonists**: *Memantine* is commonly indicated for moderate-to-severe stages to protect against glutamate excitotoxicity.
3. **Comorbid Control**: Treat active secondary symptoms like sleep disruption or anxiety under strict clinician supervision.
*Disclaimer: All pharmacotherapies must be prescribed and monitored by a registered neurologist.*`;
  }

  if (q.includes('diet') || q.includes('eat') || q.includes('nutrition')) {
    return `### 🥗 Brain Health Nutrition Guidelines
[OFFLINE DIAGNOSTIC KB FALLBACK]

The recommended dietary pattern for neuroprotection is the **MIND Diet** (Mediterranean-DASH Intervention for Neurodegenerative Delay):
*   **Green Leafy Vegetables**: Spinach, kale, and salads (minimum 6 servings/week).
*   **Berries**: Berries and strawberries (minimum 2 servings/week) for high antioxidant concentrations.
*   **Healthy Fats**: Extra virgin olive oil as the primary cooking oil.
*   **Whole Grains & Lean Proteins**: Poultry, fish, and nuts; minimize red meat, butter, and processed sugars.`;
  }

  if (q.includes('mild') || q.includes('stage') || q.includes('dement')) {
    return `### 🧠 Dementia Stages & MRI Diagnostics Overview
[OFFLINE DIAGNOSTIC KB FALLBACK]

Dementia progression is typically categorized via the Clinical Dementia Rating (CDR) scale:
*   **CDR 0 (Non-Demented)**: Normal cognitive function. MRI shows expected age-related brain volume.
*   **CDR 0.5 (Very Mild / MCI)**: Borderline cognitive impairment. Subtle short-term memory challenges.
*   **CDR 1 (Mild Dementia)**: Moderate impairment. Daily functions require minor assistance. MRI often demonstrates bilateral hippocampal atrophy.
*   **CDR 2 (Moderate) & CDR 3 (Severe)**: Pronounced decline. Continuous care is required. MRI reveals global cortical volume loss and ventricular enlargement.`;
  }

  return `### 🩺 NeuroScan AI Offline Clinical Reference
[OFFLINE DIAGNOSTIC KB FALLBACK]

I am currently running in **offline local knowledge mode** because the primary Jemmi AI streaming API is temporarily unreachable.

*   **Active Patient Context**: I am aware of your active patient record file.
*   **Clinical Inquiry**: To explore brain health, try asking about "Dementia Prevention", "Recommended Diets", or "Dementia Stage details".
*   **Support**: If you suspect a technical network issue, please contact your facility PACS IT administrator.`;
}

const getBrowserLangCode = (lang: string): string => {
  switch (lang) {
    case 'English': return 'en-US';
    case 'Telugu': return 'te-IN';
    case 'Hindi': return 'hi-IN';
    case 'Tamil': return 'ta-IN';
    case 'Kannada': return 'kn-IN';
    case 'Malayalam': return 'ml-IN';
    case 'Marathi': return 'mr-IN';
    case 'Gujarati': return 'gu-IN';
    case 'Punjabi': return 'pa-IN';
    case 'Bengali': return 'bn-IN';
    case 'Urdu': return 'ur-PK';
    case 'Spanish': return 'es-ES';
    case 'French': return 'fr-FR';
    case 'German': return 'de-DE';
    case 'Arabic': return 'ar-SA';
    case 'Japanese': return 'ja-JP';
    case 'Chinese': return 'zh-CN';
    case 'Korean': return 'ko-KR';
    case 'Portuguese': return 'pt-PT';
    case 'Italian': return 'it-IT';
    case 'Russian': return 'ru-RU';
    default: return 'en-US';
  }
};

export default function AssistantPage() {
  const toast = useToastContext();
  const { user } = useAuth();
  const { photoUrl } = useProfilePhoto();
  const { isDark, toggleDarkMode } = useDarkMode();
  const { addNotification } = useNotifications();
  const location = useLocation();
  const routeState = location.state as AssistantRouteState;

  // State variables
  const { language: globalLang, setLanguage: setGlobalLang } = useLanguage();

  const chatLangToGlobal = (lang: ChatLanguage): 'en' | 'te' | 'hi' => {
    switch (lang) {
      case 'Telugu': return 'te';
      case 'Hindi': return 'hi';
      default: return 'en';
    }
  };

  const globalToChatLang = (lang: 'en' | 'te' | 'hi'): ChatLanguage => {
    switch (lang) {
      case 'te': return 'Telugu';
      case 'hi': return 'Hindi';
      default: return 'English';
    }
  };

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [latestAnalysis, setLatestAnalysis] = useState<PredictionResult | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [language, setLanguage] = useState<ChatLanguage>(() => globalToChatLang(globalLang));
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    setLanguage(globalToChatLang(globalLang));
  }, [globalLang]);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleStopSpeaking();
        toast.info('Voice playback stopped');
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  // Custom states
  const [bookmarkedMessageIds, setBookmarkedMessageIds] = useState<Set<string>>(new Set());

  const handleToggleBookmark = (messageId: string) => {
    setBookmarkedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
        toast.info('Message removed from bookmarks');
      } else {
        next.add(messageId);
        toast.success('Message added to bookmarks');
      }
      return next;
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    toast.success('Message deleted from viewport');
  };

  const autocompleteDatabase = useMemo(() => [
    'Explain MRI',
    'Explain Heatmap',
    'Explain Confidence',
    'Explain Dementia',
    'Explain Brain Regions',
    'Show Recommendations',
    'Show medications',
    'Show scan history',
    'Can dementia be reversed?',
    'Can Alzheimer\'s be cured?',
    'What is Mild Dementia?',
    'What causes memory loss?',
    'What does confidence score mean?',
    'Should I consult a doctor?',
    'Compare with previous scan',
    'What lifestyle changes help?'
  ], []);

  const activeSuggestions = useMemo(() => {
    if (!input.trim() || input.length < 2) return [];
    return autocompleteDatabase.filter((item) =>
      item.toLowerCase().includes(input.toLowerCase()) && item.toLowerCase() !== input.toLowerCase()
    );
  }, [input, autocompleteDatabase]);

  const updateSettingsField = async (field: keyof DbUserSettings, value: any) => {
    try {
      const current = await fetchUserSettings();
      const updated = { ...current, [field]: value };
      await updateUserSettings(updated);
    } catch (err) {
      console.warn("Failed to update settings field in DB:", err);
    }
  };

  const [staggeredStep, setStaggeredStep] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const [isSpeakingPaused, setIsSpeakingPaused] = useState(false);

  // Persisted TTS controls from LocalStorage
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => {
    return localStorage.getItem('jemmi_auto_speak') === 'true';
  });
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(() => {
    return localStorage.getItem('jemmi_voice_name') || '';
  });
  const [speechVolume, setSpeechVolume] = useState<number>(() => {
    return parseFloat(localStorage.getItem('jemmi_speech_volume') || '1.0');
  });
  const [speechRate, setSpeechRate] = useState<number>(() => {
    return parseFloat(localStorage.getItem('jemmi_speech_rate') || '1.0');
  });
  const [speechPitch, setSpeechPitch] = useState<number>(() => {
    return parseFloat(localStorage.getItem('jemmi_speech_pitch') || '1.0');
  });

  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }
    const steps = [
      '🧠 Thinking...',
      '🧬 Analyzing MRI slice matrices...',
      '📄 Reading patient history context...',
      '🔬 Modeling clinical explanations...',
      '✍️ Preparing response...'
    ];
    let idx = 0;
    setStaggeredStep(steps[0]);
    const timer = setInterval(() => {
      idx = (idx + 1) % steps.length;
      setStaggeredStep(steps[idx]);
    }, 2000);
    return () => clearInterval(timer);
  }, [isLoading]);

  // Admin Knowledge Upload State
  const [adminTab, setAdminTab] = useState<'upload' | 'faq'>('upload');
  const [sidebarTab, setSidebarTab] = useState<'sessions' | 'patient' | 'rag'>('sessions');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDocType, setUploadDocType] = useState('medical_kb');
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');

  // File Attachments for message
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    content: string;
    type: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const responseCacheRef = useRef<Record<string, { answer: string; responseTime: number; model: string; tokensUsed: number }>>({});
  const requestQueueRef = useRef<string[]>([]);
  const isSendingRef = useRef(false);
  const lastSentMessageRef = useRef('');
  const handleSendMessageRef = useRef<((text: string) => Promise<void>) | null>(null);

  // Persist Voice settings updates
  useEffect(() => {
    localStorage.setItem('jemmi_auto_speak', autoSpeak.toString());
  }, [autoSpeak]);
  useEffect(() => {
    localStorage.setItem('jemmi_voice_name', selectedVoiceName);
  }, [selectedVoiceName]);
  useEffect(() => {
    localStorage.setItem('jemmi_speech_volume', speechVolume.toString());
  }, [speechVolume]);
  useEffect(() => {
    localStorage.setItem('jemmi_speech_rate', speechRate.toString());
  }, [speechRate]);
  useEffect(() => {
    localStorage.setItem('jemmi_speech_pitch', speechPitch.toString());
  }, [speechPitch]);

  // Speech synthesis load
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const available = window.speechSynthesis.getVoices();
        setVoices(available);
        if (available.length > 0 && !selectedVoiceName) {
          const defaultVoice = available.find((v) => v.default) || available.find((v) => v.lang.startsWith('en')) || available[0];
          setSelectedVoiceName(defaultVoice.name);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoiceName]);

  // Setup Speech recognition
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = useMemo(() => SpeechRecognition ? new SpeechRecognition() : null, [SpeechRecognition]);

  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  useEffect(() => {
    if (!recognition) return;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      toast.success('Voice input transcribed');

      setInput((prev) => {
        const fullPrompt = (prev + (prev ? ' ' : '') + transcript).trim();
        if (fullPrompt && !isSendingRef.current) {
          setTimeout(() => {
            if (handleSendMessageRef.current) {
              handleSendMessageRef.current(fullPrompt);
            }
          }, 50);
        }
        return fullPrompt;
      });
    };

    recognition.onerror = () => {
      setIsRecording(false);
      toast.error('Voice input error');
    };

    recognition.onend = () => {
      setIsRecording(false);
    };
  }, [recognition]);

  const activeScanId = routeState?.scanContext?.scanId ?? latestAnalysis?.scanId ?? null;
  const activePatientId = routeState?.scanContext?.patient?.id ?? latestAnalysis?.patientId ?? null;
  const activeContext = useMemo(
    () =>
      routeState?.scanContext ??
      (latestAnalysis
        ? {
            patient: {
              name: latestAnalysis.patientName,
              id: latestAnalysis.patientId,
              age: latestAnalysis.age,
              gender: latestAnalysis.gender,
              bloodGroup: latestAnalysis.bloodGroup,
              height: patientProfile?.height,
              weight: patientProfile?.weight,
              allergies: patientProfile?.allergies,
              medications: patientProfile?.medications,
              medicalHistory: patientProfile?.medical_history,
              familyHistory: patientProfile?.family_history,
              assignedDoctor: localStorage.getItem(`neuroscan_assigned_doctor_${user?.id}`) || '',
            },
            prediction: latestAnalysis.label,
            confidence: latestAnalysis.confidence,
            riskScore: latestAnalysis.riskScore,
            riskLevel: latestAnalysis.riskLevel,
            probabilities: latestAnalysis.probabilities,
            recommendations: latestAnalysis.recommendations,
            scanId: latestAnalysis.scanId,
            reportId: latestAnalysis.reportId,
          }
        : undefined),
    [latestAnalysis, routeState?.scanContext, patientProfile, user],
  );

  // Dynamic chips based on context
  const suggestedChips = useMemo(() => {
    const isNormal = activeContext?.prediction?.toLowerCase().includes('normal') ?? false;
    const isDemented = activeContext?.prediction?.toLowerCase().includes('dement') ?? false;

    if (isNormal) {
      return [
        'How to maintain cognitive health?',
        'What exercises prevent cognitive decline?',
        'What is dementia?',
        'What causes memory loss?',
        'How does NeuroScan AI work?',
        'Nutrition tips for brain wellness'
      ];
    } else if (isDemented) {
      return [
        'Explain Alzheimer\'s stages',
        'What is Mild Demented?',
        'What is Lewy Body dementia?',
        'Caregiver support guidelines',
        'Dementia risk factors',
        'What does confidence score mean?'
      ];
    }
    return [
      'What is dementia?',
      'What is Alzheimer\'s disease?',
      'Can dementia be cured?',
      'Is dementia hereditary?',
      'What causes memory loss?',
      'How accurate is MRI?',
      'What is a neurologist?',
      'How does NeuroScan AI work?'
    ];
  }, [activeContext]);

  // Load active sessions
  const loadSessions = async () => {
    try {
      const response = await apiClient.get<ChatSession[]>('/assistant/sessions');
      setSessions(response.data);
      if (response.data.length > 0 && !activeSessionId) {
        setActiveSessionId(response.data[0].id);
      }
    } catch {
      toast.error('Unable to load chat list');
    }
  };

  // Load latest analysis on mount
  useEffect(() => {
    const loadLatest = async () => {
      setIsPageLoading(true);
      try {
        const latest = await fetchLatestAnalysis();
        setLatestAnalysis(latest);
      } catch {
        setLatestAnalysis(null);
      }
      try {
        const profile = await fetchPatientProfile();
        setPatientProfile(profile);
      } catch {
        setPatientProfile(null);
      }
      try {
        const settings = await fetchUserSettings();
        if (settings) {
          setAutoSpeak(settings.voice_enabled);
          setSpeechRate(settings.speech_rate);
        }
      } catch {
        // Fall back to local defaults
      }
      try {
        await loadSessions();
      } finally {
        setTimeout(() => setIsPageLoading(false), 600);
      }
    };

    loadLatest();
  }, []);

  // Restore messages when active session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    if (isSendingRef.current) return;

    let isMounted = true;
    const restoreConversation = async () => {
      try {
        setIsRestoring(true);
        const response = await apiClient.get<ChatHistoryItem[]>('/assistant/history', {
          params: { session_id: activeSessionId },
        });
        if (!isMounted) return;

        setMessages(
          response.data.flatMap((item) => [
            {
              id: `${item.id}-question`,
              role: 'user' as const,
              content: item.question,
              timestamp: item.timestamp,
            },
            {
              id: `${item.id}-answer`,
              role: 'assistant' as const,
              content: item.answer ?? '',
              feedback: item.feedback,
              responseTime: item.responseTime,
              model: item.model,
              tokensUsed: item.tokensUsed,
              timestamp: item.timestamp,
            },
          ]),
        );

        // Sync active UI language to matches from the session
        const currentSession = sessions.find(s => s.id === activeSessionId);
        if (currentSession?.language && currentSession.language !== language) {
          setLanguage(currentSession.language as ChatLanguage);
        }
      } catch {
        if (isMounted) {
          toast.error('Unable to restore chat history');
        }
      } finally {
        if (isMounted) {
          setIsRestoring(false);
        }
      }
    };

    restoreConversation();
    return () => {
      isMounted = false;
    };
  }, [activeSessionId]);

  // Scroll to bottom helper
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Voice command handler
  const handleToggleRecording = () => {
    if (!recognition) {
      toast.error('Speech input not supported on this browser');
      return;
    }
    if (isRecording) {
      recognition.stop();
    } else {
      setIsRecording(true);
      recognition.lang = getBrowserLangCode(language);
      recognition.start();
    }
  };

  // TTS controls
  const handleToggleSpeak = (messageId: string, content: string) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Text-to-speech not supported on this browser');
      return;
    }

    if (currentlySpeakingId === messageId) {
      if (isSpeakingPaused) {
        window.speechSynthesis.resume();
        setIsSpeakingPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsSpeakingPaused(true);
      }
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = content.replace(/[*#_`~-]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = speechRate;
    utterance.pitch = speechPitch;
    utterance.volume = speechVolume;

    const langCode = getBrowserLangCode(language);
    const langPrefix = langCode.slice(0, 2).toLowerCase();

    let targetVoice = selectedVoiceName ? voices.find((v) => v.name === selectedVoiceName) : null;
    if (targetVoice && !targetVoice.lang.toLowerCase().startsWith(langPrefix)) {
      targetVoice = null;
    }

    if (!targetVoice) {
      targetVoice = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) || null;
    }

    if (targetVoice) {
      utterance.voice = targetVoice;
    } else {
      utterance.lang = langCode;
    }

    utterance.onend = () => {
      setCurrentlySpeakingId(null);
      setIsSpeakingPaused(false);
    };
    utterance.onerror = () => {
      setCurrentlySpeakingId(null);
      setIsSpeakingPaused(false);
    };

    setCurrentlySpeakingId(messageId);
    setIsSpeakingPaused(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleStopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingId(null);
      setIsSpeakingPaused(false);
    }
  };

  // Session handlers
  const handleNewSession = async () => {
    try {
      const response = await apiClient.post<ChatSession>('/assistant/sessions', {
        title: 'New Brain Health Chat',
        scan_id: activeScanId,
        patient_id: activePatientId,
        language: language,
      });
      setSessions((prev) => [response.data, ...prev]);
      setActiveSessionId(response.data.id);
      setMessages([]);
      toast.success('New session created');
    } catch {
      toast.error('Unable to start new conversation');
    }
  };

  const handleDeleteSession = async (sid: string) => {
    try {
      await apiClient.delete(`/assistant/sessions/${sid}`);
      setSessions((prev) => prev.filter((s) => s.id !== sid));
      if (activeSessionId === sid) {
        setActiveSessionId(null);
      }
      toast.success('Session deleted');
    } catch {
      toast.error('Failed to delete session');
    }
  };

  const handleToggleArchive = async (session: ChatSession) => {
    try {
      const response = await apiClient.put<ChatSession>(`/assistant/sessions/${session.id}`, {
        is_archived: !session.is_archived,
      });
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      if (activeSessionId === session.id) {
        setActiveSessionId(null);
      }
      toast.success('Conversation archived');
    } catch {
      toast.error('Could not archive conversation');
    }
  };

  const handleToggleFavorite = async (session: ChatSession) => {
    try {
      const response = await apiClient.put<ChatSession>(`/assistant/sessions/${session.id}`, {
        is_favorite: !session.is_favorite,
      });
      setSessions((prev) =>
        prev
          .map((s) => (s.id === session.id ? response.data : s))
          .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite)),
      );
      toast.success(session.is_favorite ? 'Removed from favorites' : 'Marked as favorite');
    } catch {
      toast.error('Could not update favorite status');
    }
  };

  const handleStartRename = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveRename = async (sid: string) => {
    if (!editingTitle.trim()) return;
    try {
      const response = await apiClient.put<ChatSession>(`/assistant/sessions/${sid}`, {
        title: editingTitle.trim(),
      });
      setSessions((prev) => prev.map((s) => (s.id === sid ? response.data : s)));
      setEditingSessionId(null);
      toast.success('Conversation renamed');
    } catch {
      toast.error('Failed to rename session');
    }
  };

  const handleFeedback = async (msgId: string, rating: boolean) => {
    const cleanId = msgId.replace('-answer', '');
    if (cleanId.startsWith('assistant-stream-') || cleanId.startsWith('pending-')) {
      toast.warning('Please wait for Jemmi to finish generating the response.');
      return;
    }
    try {
      await apiClient.post(`/assistant/history/message/${cleanId}/feedback`, null, {
        params: { feedback: rating },
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedback: rating } : m)),
      );
      toast.success('Feedback recorded');
    } catch {
      toast.error('Failed to submit feedback');
    }
  };

  // Admin Knowledge Upload Handling
  const handleAdminFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedDocFile(e.target.files[0]);
    }
  };

  const handleUploadKnowledge = async () => {
    if (!uploadTitle.trim() || !selectedDocFile) {
      toast.warning('Please enter a title and select a file');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('title', uploadTitle.trim());
    formData.append('doc_type', uploadDocType);
    formData.append('file', selectedDocFile);

    try {
      const token = getAccessToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/admin/upload-knowledge-doc`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      toast.success('RAG document uploaded and index updated successfully');
      setUploadTitle('');
      setSelectedDocFile(null);
      if (adminFileInputRef.current) adminFileInputRef.current.value = '';
    } catch (e: any) {
      toast.error(`Admin Upload Error: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddFaq = async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      toast.warning('Please enter both question and answer');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('question', faqQuestion.trim());
    formData.append('answer', faqAnswer.trim());

    try {
      const token = getAccessToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/admin/add-faq`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add FAQ');
      }

      toast.success('FAQ added successfully to RAG index');
      setFaqQuestion('');
      setFaqAnswer('');
    } catch (e: any) {
      toast.error(`Admin FAQ Error: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Attachment uploads for messaging
  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File exceeds 20MB limit');
      return;
    }

    const reader = new FileReader();
    const type = file.type || '';
    const isText = type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.csv');

    if (isText) {
      reader.onload = () => {
        setAttachedFile({
          name: file.name,
          content: reader.result as string,
          type: 'text/plain'
        });
        toast.success(`Attached document: ${file.name}`);
      };
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        setAttachedFile({
          name: file.name,
          content: reader.result as string,
          type: file.type || 'application/octet-stream'
        });
        toast.success(`Attached file: ${file.name}`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsGenerating(false);
    setStaggeredStep('');
    requestQueueRef.current = [];
    isSendingRef.current = false;
    toast.success('Generation stopped');
  };

  // Edit message locally
  const handleEditMessage = (content: string, index: number) => {
    setInput(content);
    setMessages((prev) => prev.slice(0, index));
    toast.info('Query loaded for editing');
  };

  // Share Response
  const handleShareMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied text to share!');
  };

  // Regenerate Response
  const handleRegenerateResponse = async () => {
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return;
    const lastUserQuery = userMessages[userMessages.length - 1].content;

    // Pop the last assistant response
    setMessages((prev) => {
      const copy = [...prev];
      if (copy[copy.length - 1]?.role === 'assistant') {
        copy.pop();
      }
      return copy;
    });

    toast.info('Regenerating response...');
    await handleSendMessage(lastUserQuery);
  };

  // Message Send handler (SSE Streaming)
  async function handleSendMessage(text: string) {
    if (!text.trim() && !attachedFile) return;

    if (isSendingRef.current || isLoading || isGenerating) {
      if (text.trim() === lastSentMessageRef.current) return;
      requestQueueRef.current.push(text);
      toast.info('Message added to queue.');
      return;
    }

    isSendingRef.current = true;
    lastSentMessageRef.current = text.trim();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const tempId = `pending-${Date.now()}`;
    const userMessage: Message = {
      id: `${tempId}-question`,
      role: 'user',
      content: text || `Analyzed attachment: ${attachedFile?.name}`,
      fileName: attachedFile?.name,
      fileType: attachedFile?.type
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Check Client cache
    const cacheKey = `${activeSessionId || 'new'}-${text.trim().toLowerCase()}`;
    if (!attachedFile && responseCacheRef.current[cacheKey]) {
      const cached = responseCacheRef.current[cacheKey];
      const assistantMessageId = `assistant-stream-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          model: cached.model,
          timestamp: new Date().toISOString()
        }
      ]);

      let currentText = '';
      const words = cached.answer.split(' ');
      let wordIdx = 0;

      setIsGenerating(true);
      const streamInterval = setInterval(() => {
        if (controller.signal.aborted) {
          clearInterval(streamInterval);
          setIsGenerating(false);
          isSendingRef.current = false;
          return;
        }

        if (wordIdx < words.length) {
          currentText += (wordIdx > 0 ? ' ' : '') + words[wordIdx];
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: currentText } : msg
            )
          );
          wordIdx++;
        } else {
          clearInterval(streamInterval);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    id: `cached-reply-${Date.now()}-answer`,
                    content: cached.answer,
                    responseTime: cached.responseTime,
                    model: cached.model,
                    tokensUsed: cached.tokensUsed
                  }
                : msg
            )
          );
          setIsGenerating(false);
          isSendingRef.current = false;

          if (autoSpeak) {
            handleToggleSpeak(`cached-reply-${Date.now()}-answer`, cached.answer);
          }

          if (requestQueueRef.current.length > 0) {
            const nextMsg = requestQueueRef.current.shift();
            if (nextMsg) {
              setTimeout(() => handleSendMessage(nextMsg), 100);
            }
          }
        }
      }, 25);

      return;
    }

    setIsLoading(true);
    setIsGenerating(true);
    setStaggeredStep('Classifying query intent...');

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    try {
      await delay(200);
      if (controller.signal.aborted) return;
      setStaggeredStep('Retrieving local patient indices...');
      await delay(200);
      if (controller.signal.aborted) return;
      setStaggeredStep('Processing response...');

      const token = getAccessToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/assistant/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          context: activeContext,
          language,
          session_id: activeSessionId,
          file_name: attachedFile?.name,
          file_content: attachedFile?.content,
          file_type: attachedFile?.type
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Streaming failed');
      }

      setAttachedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) throw new Error('No reader available');

      let currentAnswer = '';
      let targetText = '';
      let resolvedSessionId = activeSessionId;
      const assistantMessageId = `assistant-stream-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          model: 'gemini-flash-latest',
          timestamp: new Date().toISOString()
        }
      ]);

      setStaggeredStep('');
      setIsLoading(false);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const textChunk = decoder.decode(value);
          const lines = textChunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') break;
              try {
                const data = JSON.parse(dataStr);
                if (data.event === 'session_created') {
                  resolvedSessionId = data.session_id;
                  setActiveSessionId(data.session_id);
                  loadSessions();
                } else if (data.event === 'chunk') {
                  targetText += data.text;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: targetText } : msg
                    )
                  );
                } else if (data.event === 'completed') {
                  const history = data.history_item;

                  // Cache final response
                  const responseCacheKey = `${resolvedSessionId || 'new'}-${text.trim().toLowerCase()}`;
                  responseCacheRef.current[responseCacheKey] = {
                    answer: history.answer,
                    responseTime: history.responseTime,
                    model: history.model,
                    tokensUsed: history.tokensUsed
                  };
                  addNotification(
                    'info',
                    'Assistant Replied',
                    `Jemmi AI replied to your inquiry: "${text.length > 40 ? text.slice(0, 40) + '...' : text}"`
                  );

                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            id: `${history.id}-answer`,
                            content: history.answer,
                            responseTime: history.responseTime,
                            model: history.model,
                            tokensUsed: history.tokensUsed
                          }
                        : msg
                    )
                  );

                  // Auto-sync frontend UI dropdown language to detected response language
                  if (history.language && history.language !== language) {
                    setLanguage(history.language as ChatLanguage);
                    toast.success(`Language detected: ${history.language}`);
                  }

                  if (autoSpeak) {
                    handleToggleSpeak(`${history.id}-answer`, history.answer);
                  }
                }
              } catch {
                // Ignore line parsing errors
              }
            }
          }
        }
      } catch (streamErr) {
        throw streamErr;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;

      const offlineReply = getOfflineFallbackResponse(text);
      const assistantMessageId = `assistant-offline-${Date.now()}`;

      setMessages((prev) => {
        const pendingIdx = prev.findIndex(m => m.id.startsWith('assistant-stream-'));
        if (pendingIdx !== -1) {
          return prev.map((m, idx) =>
            idx === pendingIdx
              ? {
                  id: assistantMessageId,
                  role: 'assistant',
                  content: offlineReply,
                  model: 'local-knowledge-base',
                  timestamp: new Date().toISOString(),
                  responseTime: 0.1,
                  tokensUsed: 120
                }
              : m
          );
        } else {
          return [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: offlineReply,
              model: 'local-knowledge-base',
              timestamp: new Date().toISOString(),
              responseTime: 0.1,
              tokensUsed: 120
            }
          ];
        }
      });

      addNotification(
        'warning',
        'Offline Fallback Active',
        'Gemini API stream failed; loaded local medical knowledge guidelines.'
      );
      toast.warning('Using offline clinical knowledge base fallback');
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
      setStaggeredStep('');
      abortControllerRef.current = null;
      isSendingRef.current = false;

      if (requestQueueRef.current.length > 0) {
        const nextMsg = requestQueueRef.current.shift();
        if (nextMsg) {
          setTimeout(() => handleSendMessage(nextMsg), 100);
        }
      }
    }
  }

  const handleExportMarkdown = () => {
    if (messages.length === 0) return;
    const header = `# NeuroScan AI - Jemmi AI Conversation Log\nExport Date: ${new Date().toLocaleDateString()}\nPatient: ${activeContext?.patient?.name ?? 'Unknown'}\nScan Prediction: ${activeContext?.prediction ?? 'None'}\n\n`;
    const logs = messages
      .map((m) => `### ${m.role === 'user' ? 'Patient Question' : 'Jemmi AI Clinical Response'}\n\n${m.content}\n\n---`)
      .join('\n\n');
    const blob = new Blob([header + logs], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Jemmi-Conversation-${activeSessionId || 'Report'}.md`;
    link.click();
    toast.success('Conversation exported successfully!');
  };

  const getFollowUpChips = () => {
    const label = activeContext?.prediction || 'Mild Dementia';
    const conf = activeContext?.confidence ? `${activeContext.confidence.toFixed(1)}%` : '93.4%';
    return [
      `Explain ${label}`,
      `Why is model confidence ${conf}?`,
      'What does the Grad-CAM heatmap indicate?',
      'Should this patient consult a neurologist?',
      'How can cognitive progression be slowed?'
    ];
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [sessions, searchQuery]);

  // High-End Custom Markdown and Card Renderer
  const renderInlineMarkdown = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|__.*?__|__.*?__|\*.*?\*|_.*?_|`.*?`)/g;
    const splitParts = text.split(regex);

    splitParts.forEach((part, idx) => {
      if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
        parts.push(<strong key={idx} className="font-extrabold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>);
      } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
        parts.push(<em key={idx} className="italic text-slate-700 dark:text-slate-350">{part.slice(1, -1)}</em>);
      } else if (part.startsWith('`') && part.endsWith('`')) {
        parts.push(
          <code key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0E1322]/80 border border-slate-200 dark:border-white/5 font-mono text-xs text-rose-500 dark:text-rose-400">
            {part.slice(1, -1)}
          </code>
        );
      } else {
        parts.push(part);
      }
    });
    return parts;
  };

  const renderMarkdownBlocks = (text: string) => {
    const blocks = text.split(/\n\n+/);
    return blocks.map((block, bIdx) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      // Card Detection: MRI Diagnostic report card
      if (trimmed.startsWith('### 🧠 MRI Screening Summary') || trimmed.startsWith('### 🧠 Active Brain MRI')) {
        const lines = trimmed.split('\n');
        const header = lines[0].replace(/^###\s*/, '');
        const items = lines.slice(1).map(l => l.replace(/^[\*\-\•]\s+/, '').split(': '));

        return (
          <div key={bIdx} className="my-4 p-5 rounded-[22px] border border-sky-100 dark:border-sky-950/40 bg-gradient-to-br from-sky-50/50 to-indigo-50/30 dark:from-sky-950/20 dark:to-indigo-950/10 shadow-sm backdrop-blur-md relative overflow-hidden group hover:shadow-md transition duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-20 text-sky-500">
              <Brain className="h-14 w-14" />
            </div>
            <div className="flex items-center gap-2 border-b border-sky-100 dark:border-sky-900/50 pb-2 mb-3">
              <Activity className="h-4.5 w-4.5 text-sky-500" />
              <h4 className="font-extrabold text-sky-900 dark:text-sky-300 text-sm font-[Manrope] uppercase tracking-wider">{header}</h4>
            </div>
            <div className="grid gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {items.map((it, i) => (
                <div key={i} className="flex justify-between py-1 border-b border-sky-100/30 dark:border-sky-900/20">
                  <span className="text-slate-500 dark:text-slate-500 font-bold">{it[0]}</span>
                  <span className="text-slate-700 dark:text-slate-200 font-extrabold">{it[1] ? renderInlineMarkdown(it[1]) : 'N/A'}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Card Detection: Patient clinical profile
      if (trimmed.startsWith('### 👤 Patient Profile Record')) {
        const lines = trimmed.split('\n');
        const header = lines[0].replace(/^###\s*/, '');

        return (
          <div key={bIdx} className="my-4 p-5 rounded-[22px] border border-teal-100 dark:border-teal-950/40 bg-gradient-to-br from-teal-50/40 to-emerald-50/30 dark:from-teal-950/20 dark:to-emerald-950/10 shadow-sm backdrop-blur-md relative overflow-hidden group hover:shadow-md transition duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-20 text-teal-500">
              <Activity className="h-14 w-14" />
            </div>
            <div className="flex items-center gap-2 border-b border-teal-100 dark:border-teal-900/50 pb-2 mb-3">
              <Activity className="h-4.5 w-4.5 text-teal-500" />
              <h4 className="font-extrabold text-teal-900 dark:text-teal-300 text-sm font-[Manrope] uppercase tracking-wider">{header}</h4>
            </div>
            <div className="grid gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {lines.slice(1).map((line, idx) => {
                if (line.includes('|') && !line.includes('---')) {
                  const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                  if (cells.length === 2) {
                    return (
                      <div key={idx} className="flex justify-between py-1 border-b border-teal-100/30 dark:border-teal-900/20">
                        <span className="text-slate-500 dark:text-slate-500 font-bold">{cells[0].replace(/\*\*/g, '')}</span>
                        <span className="text-slate-700 dark:text-slate-200 font-extrabold">{renderInlineMarkdown(cells[1])}</span>
                      </div>
                    );
                  }
                }
                return null;
              })}
            </div>
          </div>
        );
      }

      // Check if block is a table
      if (trimmed.startsWith('|') && trimmed.includes('\n|')) {
        const lines = trimmed.split('\n');
        const headers = lines[0].split('|').map(s => s.trim()).filter(Boolean);
        const rows = lines.slice(2).map(line => line.split('|').map(s => s.trim()).filter(Boolean)).filter(r => r.length > 0);
        return (
          <div key={bIdx} className="overflow-x-auto my-3 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
            <table className="w-full text-xs text-left border-collapse bg-white dark:bg-[#181E32]/40">
              <thead>
                <tr className="bg-[#F5F8FC] dark:bg-[#0E1322]/60 text-slate-500 dark:text-slate-500 font-bold border-b border-slate-200 dark:border-white/5">
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 font-bold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#F5F8FC]/50 dark:hover:bg-white/5 transition font-semibold text-slate-700 dark:text-slate-200">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-3">{renderInlineMarkdown(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      // Check if block is a code block
      if (trimmed.startsWith('```')) {
        const lines = trimmed.split('\n');
        const codeText = lines.slice(1, -1).join('\n');
        return (
          <pre key={bIdx} className="p-4 rounded-[22px] bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto my-3 shadow-md">
            <code>{codeText}</code>
          </pre>
        );
      }

      // Check if block is an ordered list
      if (/^\d+\.\s+/.test(trimmed)) {
        const lines = trimmed.split('\n');
        return (
          <ol key={bIdx} className="list-decimal pl-5 my-2 space-y-1.5 text-slate-700 dark:text-slate-300 font-semibold text-xs leading-relaxed">
            {lines.map((line, idx) => {
              const itemText = line.replace(/^\d+\.\s+/, '');
              return <li key={idx}>{renderInlineMarkdown(itemText)}</li>;
            })}
          </ol>
        );
      }

      // Check if block is a list
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        const lines = trimmed.split('\n');
        return (
          <ul key={bIdx} className="list-disc pl-5 my-2 space-y-1.5 text-slate-700 dark:text-slate-300 font-semibold text-xs leading-relaxed">
            {lines.map((line, idx) => {
              const itemText = line.replace(/^[\*\-\•]\s+/, '');
              return <li key={idx}>{renderInlineMarkdown(itemText)}</li>;
            })}
          </ul>
        );
      }

      // Check if block is a blockquote
      if (trimmed.startsWith('>')) {
        const quoteText = trimmed.replace(/^>\s*/, '');
        return (
          <blockquote key={bIdx} className="border-l-4 border-medical-blue bg-medical-blue/5 dark:bg-medical-blue/10 dark:border-medical-blue/80 px-4 py-2.5 my-3 rounded-r-xl text-xs text-slate-700 dark:text-slate-300 italic font-semibold leading-relaxed">
            {renderInlineMarkdown(quoteText)}
          </blockquote>
        );
      }

      // Check if block is a header
      if (trimmed.startsWith('###')) {
        const headingText = trimmed.replace(/^###\s*/, '');
        return (
          <h4 key={bIdx} className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-4 mb-2 font-[Manrope] border-b border-slate-200 dark:border-white/5 pb-1">
            {renderInlineMarkdown(headingText)}
          </h4>
        );
      }

      if (trimmed.startsWith('####')) {
        const headingText = trimmed.replace(/^####\s*/, '');
        return (
          <h5 key={bIdx} className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mt-3 mb-1 uppercase tracking-wider">
            {renderInlineMarkdown(headingText)}
          </h5>
        );
      }

      // General Paragraph
      return (
        <p key={bIdx} className="my-2 leading-relaxed text-xs text-slate-700 dark:text-slate-300 font-semibold">
          {renderInlineMarkdown(trimmed)}
        </p>
      );
    });
  };

  if (isPageLoading) {
    return <SkeletonLoader type="assistant" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6 animate-fadeIn transition-colors duration-300"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <SectionHeading
          eyebrow="Jemmi AI Healthcare Assistant"
          title="Dementia-Specialized Brain Health Copilot"
          description="Interact with Jemmi AI to explore cognitive predictions, run RAG document uploads, search medical facts, and listen to voice diagnostic support."
        />

        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={toggleDarkMode}
            className="flex items-center justify-center p-2.5 rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#181E32] shadow-sm text-slate-500 dark:text-slate-300 hover:bg-[#F5F8FC] dark:hover:bg-[#0E1322] transition"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400 animate-pulse" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">

        {/* SIDEBAR: Unified Operations Panel */}
        <div className="flex flex-col rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#0E1322]/60 p-4 shadow-sm h-[680px] backdrop-blur-xl ring-1 ring-slate-100 dark:ring-white/5 transition-all duration-300">

          {/* Segmented Sidebar Tabs */}
          <div className="flex rounded-3xl bg-slate-100 dark:bg-[#0E1322] p-1 mb-4 text-[10px] font-extrabold shadow-inner border border-slate-200/50 dark:border-white/5 shrink-0">
            <button
              onClick={() => setSidebarTab('sessions')}
              className={`flex-grow py-2 rounded-3xl text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${sidebarTab === 'sessions' ? 'bg-white dark:bg-[#181E32] shadow-sm text-medical-blue' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Chats
            </button>
            <button
              onClick={() => setSidebarTab('patient')}
              className={`flex-grow py-2 rounded-3xl text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${sidebarTab === 'patient' ? 'bg-white dark:bg-[#181E32] shadow-sm text-medical-blue' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              <Activity className="h-3.5 w-3.5" />
              Patient
            </button>
            <button
              onClick={() => setSidebarTab('rag')}
              className={`flex-grow py-2 rounded-3xl text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${sidebarTab === 'rag' ? 'bg-white dark:bg-[#181E32] shadow-sm text-medical-blue' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              <Database className="h-3.5 w-3.5" />
              RAG
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4">
            {sidebarTab === 'sessions' && (
              <div className="space-y-4">
                <div>
                  <button
                    onClick={handleNewSession}
                    className="flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-sky-500 to-medical-blue py-3 font-extrabold text-white transition hover:opacity-95 shadow-md shadow-sky-500/10 hover:shadow-sky-500/20 active:scale-95 cursor-pointer text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    New Conversation
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-3xl border border-slate-200 dark:border-white/5 bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40 py-2.5 pl-9 pr-4 text-xs outline-none placeholder:text-slate-500 dark:placeholder:text-slate-700 focus:border-slate-300 dark:focus:border-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-950 transition font-bold"
                  />
                </div>

                {/* Chat Sessions list */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {filteredSessions.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-6 font-bold">No conversations found</p>
                  ) : (
                    filteredSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`group relative flex items-center justify-between gap-1 rounded-3xl p-3 text-left text-xs font-extrabold transition cursor-pointer border ${
                          activeSessionId === session.id
                            ? 'bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border-sky-500/25 text-medical-blue dark:text-sky-400 shadow-sm'
                            : 'text-slate-700 dark:text-slate-500 border-transparent hover:bg-[#F5F8FC] dark:hover:bg-white/5'
                        }`}
                        onClick={() => editingSessionId !== session.id && setActiveSessionId(session.id)}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <Sparkles className={`h-3.5 w-3.5 shrink-0 ${activeSessionId === session.id ? 'text-medical-blue dark:text-sky-400' : 'text-slate-500'}`} />

                          {editingSessionId === session.id ? (
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => handleSaveRename(session.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(session.id)}
                              className="w-full rounded border border-slate-300 dark:border-white/10 px-1 py-0.5 outline-none focus:border-medical-blue bg-white dark:bg-[#0E1322] text-slate-900 dark:text-white"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="truncate pr-4">{session.title}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition absolute right-2 bg-gradient-to-l from-slate-50 pl-4 py-1 rounded-r-xl group-hover:from-transparent dark:from-slate-950/80">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(session);
                            }}
                            className="p-1 text-slate-500 hover:text-amber-500 transition"
                            title="Favorite chat"
                          >
                            <Star className={`h-3.5 w-3.5 ${session.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRename(session);
                            }}
                            className="p-1 text-slate-500 hover:text-medical-blue transition"
                            title="Rename chat"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleArchive(session);
                            }}
                            className="p-1 text-slate-500 hover:text-indigo-500 transition"
                            title="Archive chat"
                          >
                            <MaterialIcon name="archive" className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                            className="p-1 text-slate-500 hover:text-red-500 transition"
                            title="Delete chat"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {session.is_favorite && editingSessionId !== session.id && (
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400 absolute right-3 pointer-events-none group-hover:opacity-0 transition" />
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Suggested Inquiries inside Sidebar */}
                <div className="border-t border-slate-200 dark:border-white/5 pt-4">
                  <div className="flex items-center gap-2 pb-2">
                    <HeartPulse className="h-4 w-4 text-sky-500" />
                    <h4 className="font-extrabold text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider font-[Manrope]">Suggested Inquiries</h4>
                  </div>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                    {suggestedChips.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => handleSendMessage(chip)}
                        disabled={isLoading || isRestoring}
                        className="w-full text-left text-[10px] bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40 border border-slate-200/50 dark:border-white/5 hover:border-medical-blue/30 dark:hover:border-sky-500/30 hover:bg-slate-100/50 dark:hover:bg-[#0E1322]/40 p-2 rounded-3xl font-bold text-slate-650 dark:text-slate-350 transition leading-snug cursor-pointer shadow-sm"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 rounded-3xl bg-amber-50/85 dark:bg-amber-950/20 p-2.5 text-[9px] text-amber-700 dark:text-amber-300 leading-normal border border-amber-100/50 dark:border-amber-900/30">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="font-bold">
                    <strong>Clinically-guided AI:</strong> Educational support only. A registered neurologist assessment is required to diagnose cognitive disorders.
                  </span>
                </div>
              </div>
            )}

            {sidebarTab === 'patient' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-white/5">
                  <Activity className="h-4 w-4 text-medical-blue dark:text-sky-400" />
                  <h4 className="font-extrabold text-[10px] text-slate-455 dark:text-slate-500 uppercase tracking-wider font-[Manrope]">Patient Context</h4>
                </div>

                <div className="flex items-center gap-3">
                  <ProfileAvatar src={photoUrl} name={activeContext?.patient?.name ?? user?.name} sizeClassName="h-10 w-10 border border-slate-200 dark:border-white/5" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-slate-850 dark:text-white">
                      {activeContext?.patient?.name ?? user?.name ?? 'Anonymous Patient'}
                    </p>
                    <p className="truncate text-[9px] text-slate-500 dark:text-slate-500 font-extrabold tracking-wider">
                      ID: {activeContext?.patient?.id?.slice(0, 12) ?? 'Unavailable'}...
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-extrabold">
                  <div className="bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40 p-2 border border-slate-200 dark:border-white/5 rounded-3xl">
                    <span className="text-slate-500 dark:text-slate-500 block text-[9px] uppercase tracking-wider">Age</span>
                    <span className="text-slate-900 dark:text-slate-200 font-extrabold">{activeContext?.patient?.age ?? 68} years</span>
                  </div>
                  <div className="bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40 p-2 border border-slate-200 dark:border-white/5 rounded-3xl">
                    <span className="text-slate-500 dark:text-slate-500 block text-[9px] uppercase tracking-wider">Gender</span>
                    <span className="text-slate-900 dark:text-slate-200 font-extrabold capitalize">{activeContext?.patient?.gender ?? 'Male'}</span>
                  </div>
                  <div className="bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40 p-2 border border-slate-200 dark:border-white/5 rounded-3xl">
                    <span className="text-slate-500 dark:text-slate-500 block text-[9px] uppercase tracking-wider">Blood Group</span>
                    <span className="text-slate-900 dark:text-slate-200 font-extrabold">{activeContext?.patient?.bloodGroup ?? 'O+'}</span>
                  </div>
                  <div className="bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40 p-2 border border-slate-200 dark:border-white/5 rounded-3xl">
                    <span className="text-slate-500 dark:text-slate-500 block text-[9px] uppercase tracking-wider">DOB</span>
                    <span className="text-slate-900 dark:text-slate-200 font-extrabold text-[10px]">12-Aug-1958</span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-200 dark:border-white/5 pt-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  <div>
                    <span className="text-slate-500 font-semibold block">Active Medications</span>
                    <p className="text-slate-700 dark:text-slate-350 normal-case mt-0.5 leading-normal">Donepezil 10mg daily, Memantine 10mg twice daily</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">Known Allergies</span>
                    <p className="text-slate-700 dark:text-slate-350 normal-case mt-0.5 leading-normal">Penicillin (Severe Rash)</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">Emergency Contact</span>
                    <p className="text-slate-700 dark:text-slate-350 normal-case mt-0.5 leading-normal">Sarah Connor (+91 99480 00000)</p>
                  </div>
                </div>

                {activeContext ? (
                  <div className="rounded-3xl bg-medical-blue/5 border border-clinical-primary/10 p-3 mt-2">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-medical-blue shrink-0" />
                      <span className="font-extrabold text-xs text-medical-blue uppercase tracking-wider">{activeContext.prediction}</span>
                    </div>
                    <div className="mt-2 space-y-1.5 text-xs font-semibold text-slate-500">
                      <p className="flex justify-between"><span>Confidence:</span> <span className="text-slate-900 dark:text-white font-extrabold">{Math.round(activeContext.confidence ?? 0)}%</span></p>
                      <p className="flex justify-between"><span>Risk Rating:</span> <span className="text-slate-900 dark:text-white font-extrabold">{Math.round(activeContext.riskScore ?? 0)}/100</span></p>
                      {activeContext.reportId && (
                        <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-200/50 dark:border-slate-800 mt-2 uppercase">
                          <span>Report</span>
                          <a href={`/results/${activeContext.scanId}`} className="text-medical-blue font-bold hover:underline">Open Workbench</a>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40 p-4 text-center text-xs text-slate-500">
                    No active scan analysis detected. Start an MRI diagnostic to load scan highlights.
                  </div>
                )}
              </div>
            )}

            {sidebarTab === 'rag' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-white/5">
                  <Database className="h-4 w-4 text-indigo-500" />
                  <h4 className="font-extrabold text-[10px] text-slate-455 dark:text-slate-500 uppercase tracking-wider font-[Manrope]">RAG Indexer</h4>
                </div>

                <div className="flex rounded-3xl bg-slate-100 dark:bg-[#0E1322] p-1 text-[10px] font-extrabold shadow-inner">
                  <button
                    onClick={() => setAdminTab('upload')}
                    className={`flex-grow py-1.5 rounded-lg text-center transition cursor-pointer ${adminTab === 'upload' ? 'bg-white dark:bg-[#181E32] shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Upload File
                  </button>
                  <button
                    onClick={() => setAdminTab('faq')}
                    className={`flex-grow py-1.5 rounded-lg text-center transition cursor-pointer ${adminTab === 'faq' ? 'bg-white dark:bg-[#181E32] shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Add FAQ
                  </button>
                </div>

                {adminTab === 'upload' ? (
                  <div className="space-y-3 text-xs font-bold text-slate-700 dark:text-slate-350">
                    <div>
                      <label className="text-[9px] text-slate-500 block mb-1 uppercase font-extrabold">Document Title</label>
                      <input
                        type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="e.g. WHO Dementia Policy 2026"
                        className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 p-2 font-bold bg-white dark:bg-[#181E32] outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 block mb-1 uppercase font-extrabold">Doc Type / Category</label>
                      <select
                        value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value)}
                        className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 p-2 font-bold bg-white dark:bg-[#181E32] outline-none focus:border-indigo-500"
                      >
                        <option value="medical_kb">Medical KB Article</option>
                        <option value="guidelines">Clinical Guidelines</option>
                        <option value="report_template">MRI Templates</option>
                        <option value="who_guidance">WHO Guidance</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 block mb-1 uppercase font-extrabold">Select Document (.txt, .md, .csv, .pdf, .docx)</label>
                      <input
                        type="file" ref={adminFileInputRef} onChange={handleAdminFileChange}
                        accept=".txt,.md,.markdown,.csv,.pdf,.docx"
                        className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[9px] file:font-extrabold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                      />
                    </div>
                    <button
                      onClick={handleUploadKnowledge}
                      disabled={isUploading || !uploadTitle || !selectedDocFile}
                      className="w-full flex items-center justify-center gap-1.5 rounded-3xl bg-indigo-600 hover:bg-indigo-700 py-2 text-xs text-white font-extrabold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isUploading ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Index Document
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs font-bold text-slate-700 dark:text-slate-350">
                    <div>
                      <label className="text-[9px] text-slate-500 block mb-1 uppercase font-extrabold">Question / Term</label>
                      <input
                        type="text" value={faqQuestion} onChange={(e) => setFaqQuestion(e.target.value)}
                        placeholder="e.g. Is memory loss treatable?"
                        className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 p-2 font-bold bg-white dark:bg-[#181E32] outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 block mb-1 uppercase font-extrabold">Answer / Definition</label>
                      <textarea
                        value={faqAnswer} onChange={(e) => setFaqAnswer(e.target.value)}
                        placeholder="Provide a clear, brief explanation..." rows={3}
                        className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 p-2 font-bold bg-white dark:bg-[#181E32] outline-none focus:border-indigo-500 resize-none"
                      />
                    </div>
                    <button
                      onClick={handleAddFaq}
                      disabled={isUploading || !faqQuestion || !faqAnswer}
                      className="w-full flex items-center justify-center gap-1.5 rounded-3xl bg-indigo-600 hover:bg-indigo-700 py-2 text-xs text-white font-extrabold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isUploading ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Add FAQ to RAG
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CHAT INTERFACE: Conversation panel */}
        <div className="flex flex-col rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#0E1322]/60 shadow-md h-[680px] overflow-hidden relative backdrop-blur-xl ring-1 ring-slate-100 dark:ring-white/5 transition-all duration-300">

          {/* Header row */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 p-4 bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40 backdrop-blur-md">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-500">Jemmi AI Healthcare Assistant</p>
              <h3 className="font-[Manrope] text-base font-extrabold text-medical-ink dark:text-white truncate max-w-xs md:max-w-sm">
                {sessions.find((s) => s.id === activeSessionId)?.title ?? 'Jemmi AI Conversation'}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="inline-flex items-center gap-1 rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0E1322] px-2 py-1.5 text-[10px] font-extrabold text-slate-700 dark:text-slate-300 shadow-sm cursor-pointer hover:border-slate-300 transition">
                <Languages className="h-3.5 w-3.5 text-medical-blue dark:text-sky-400" />
                <select
                  value={language}
                  onChange={(event) => {
                    const val = event.target.value as ChatLanguage;
                    setLanguage(val);
                    setGlobalLang(chatLangToGlobal(val));
                  }}
                  className="bg-transparent font-extrabold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  aria-label="Language selection"
                >
                  {chatLanguages.map((chatLanguage) => (
                    <option key={chatLanguage} value={chatLanguage} className="dark:bg-[#0E1322]">
                      {chatLanguage}
                    </option>
                  ))}
                </select>
              </label>

              <button
                onClick={handleExportMarkdown}
                disabled={messages.length === 0}
                className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0E1322] p-2 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0E1322] hover:text-medical-blue disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                title="Export Conversation"
              >
                <Download className="h-4 w-4" />
              </button>

              <button
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                className={`rounded-3xl border p-2 transition shadow-sm ${
                  showVoiceSettings
                    ? 'border-medical-blue bg-medical-blue/5 dark:bg-sky-500/10 text-medical-blue dark:text-sky-400 dark:border-sky-500/30'
                    : 'border-slate-200 dark:border-white/5 bg-white dark:bg-[#0E1322] text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0E1322]'
                }`}
                title="Voice Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* TTS Dynamic Control Panel overlay */}
          {showVoiceSettings && (
            <div className="absolute top-[68px] left-0 w-full bg-white/95 dark:bg-[#0E1322]/95 border-b border-slate-200 dark:border-white/5 shadow-lg p-4 z-20 grid gap-4 md:grid-cols-4 text-xs font-bold text-slate-700 dark:text-slate-300 animate-slideDown backdrop-blur-md">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-extrabold block">Select Voice</span>
                <select
                  value={selectedVoiceName}
                  onChange={(e) => setSelectedVoiceName(e.target.value)}
                  className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 p-2 font-extrabold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#181E32] outline-none focus:border-medical-blue"
                >
                  <option value="">Browser default ({getBrowserLangCode(language)})</option>
                  {voices
                    .filter((v) => v.lang.startsWith(getBrowserLangCode(language).slice(0, 2)))
                    .map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-extrabold flex justify-between">
                  <span>Volume</span>
                  <span>{Math.round(speechVolume * 100)}%</span>
                </span>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={speechVolume}
                  onChange={(e) => setSpeechVolume(parseFloat(e.target.value))}
                  className="w-full accent-medical-blue h-1 mt-2.5"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-extrabold flex justify-between">
                  <span>Speech Rate</span>
                  <span>{speechRate}x</span>
                </span>
                <input
                  type="range" min="0.5" max="2" step="0.25"
                  value={speechRate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value);
                    setSpeechRate(rate);
                    updateSettingsField('speech_rate', rate);
                  }}
                  className="w-full accent-medical-blue h-1 mt-2.5"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-extrabold block">Voice Mode Actions</span>
                <div className="flex items-center gap-2 mt-1">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoSpeak}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setAutoSpeak(val);
                        updateSettingsField('voice_enabled', val);
                      }}
                      className="accent-medical-blue h-3.5 w-3.5 rounded border-slate-300"
                    />
                    <span className="text-xs text-slate-700 dark:text-slate-300">Auto Speak Replies</span>
                  </label>
                  {currentlySpeakingId && (
                    <button
                      onClick={handleStopSpeaking}
                      className="ml-auto text-[10px] text-red-500 bg-red-50 dark:bg-red-950/30 dark:border-red-900/40 border border-red-100 rounded px-1.5 py-0.5 hover:bg-red-100 transition"
                    >
                      Mute Voice
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Patient Summary Card */}
          {activeContext && (
            <div className="mx-4 mt-4 p-3 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/25 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-sky-500/20 flex items-center justify-center text-medical-blue font-extrabold text-lg">
                  {activeContext.patient?.name?.charAt(0).toUpperCase() || 'P'}
                </div>
                <div>
                  <div className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                    <span>{activeContext.patient?.name || 'Anonymous Patient'}</span>
                    <span className="text-[10px] bg-sky-500/20 text-medical-blue px-2 py-0.5 rounded-full font-bold">
                      {activeContext.patient?.gender || 'N/A'}, {activeContext.patient?.age || 'N/A'} yrs
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-extrabold">
                    ID: <span className="font-mono">{activeContext.patient?.id || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block">AI Screening</span>
                  <span className="font-extrabold text-medical-blue dark:text-sky-400">
                    {activeContext.prediction || 'No Prediction'} ({Math.round(activeContext.confidence ?? 0)}%)
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Atrophy Risk</span>
                  <span className="font-extrabold text-rose-500 font-extrabold">
                    {activeContext.riskScore !== undefined ? `${activeContext.riskScore}/100` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Assigned Specialist</span>
                  <span className="font-extrabold text-slate-700 dark:text-slate-350">
                    {(activeContext.patient as any)?.assignedDoctor || 'Unassigned'}
                  </span>
                </div>
                {activeContext.scanId && (
                  <div className="flex items-center">
                    <a
                      href={`/results/${activeContext.scanId}`}
                      className="px-3 py-1.5 rounded-full bg-medical-blue hover:bg-clinical-primary text-white text-[10px] font-extrabold shadow-sm transition"
                    >
                      Open PACS Workbench
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Message log display */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40 custom-scrollbar">
            {isRestoring ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Loader className="mx-auto mb-2 h-7 w-7 animate-spin text-medical-blue" />
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-500">Restoring clinical conversation log...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center p-4">
                <div className="max-w-md w-full bg-white/60 dark:bg-[#0E1322]/60 border border-slate-200 dark:border-white/5 rounded-3xl p-6 text-center space-y-4 shadow-sm backdrop-blur-md">
                  <div className="mx-auto h-11 w-11 rounded-3xl bg-medical-blue/10 dark:bg-sky-500/10 flex items-center justify-center text-medical-blue dark:text-sky-400">
                    <Brain className="h-5.5 w-5.5 animate-pulse" />
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-extrabold text-medical-ink dark:text-white text-base">Jemmi AI Medical Copilot</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-500 font-extrabold uppercase tracking-wider">Brain & Neurological Wellness Assistant</p>
                  </div>

                  <div className="text-left bg-[#F5F8FC]/50 dark:bg-[#0E1322]/30 border border-slate-200 dark:border-white/5 rounded-3xl p-4 space-y-2 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <p className="font-extrabold text-slate-700 dark:text-slate-200 pb-1.5 border-b border-slate-200 dark:border-white/5 flex items-center gap-1.5">
                      <span>🩺</span>
                      <span>Clinical Off-line Capabilities:</span>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">🧠</span>
                        <span>Dementia KB</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">📄</span>
                        <span>MRI Reports</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">📂</span>
                        <span>Patient Records</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">🌍</span>
                        <span>21 Languages</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[9px] text-slate-500 dark:text-slate-500 leading-relaxed max-w-sm mx-auto">
                    *Clinical Disclaimer: Jemmi AI provides educational resources and machine learning insights. It is not a clinical replacement for diagnostic neurologist assessments.*
                  </p>

                  <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                    {suggestedChips.slice(0, 3).map((chip) => (
                      <button
                        key={chip}
                        onClick={() => handleSendMessage(chip)}
                        disabled={isLoading || isGenerating}
                        className="rounded-full bg-white dark:bg-[#0E1322] border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-[10px] font-extrabold text-slate-700 dark:text-slate-300 hover:border-medical-blue hover:bg-medical-blue/5 hover:text-medical-blue dark:hover:text-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm cursor-pointer"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, mIndex) => {
                  const isUser = message.role === 'user';
                  return (
                    <div
                      key={message.id}
                      className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-400 to-medical-blue text-white shadow-sm ring-1 ring-white/10">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      )}
                      <div className="max-w-[82%] space-y-1">
                        <div
                          className={`rounded-3xl px-4 py-3 text-xs leading-relaxed border transition shadow-sm ${
                            isUser
                              ? 'rounded-tr-sm bg-gradient-to-br from-sky-500 to-medical-blue text-white border-sky-500/20'
                              : 'rounded-tl-sm bg-white dark:bg-[#181E32] text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-white/5'
                          }`}
                        >
                          {isUser && message.fileName && (
                            <div className="mb-1.5 text-[9px] bg-white/20 px-2 py-0.5 rounded flex items-center gap-1 font-extrabold w-fit">
                              <Paperclip className="h-3 w-3" />
                              <span>{message.fileName}</span>
                            </div>
                          )}

                          {/* Markdown Block Parser */}
                          {isUser ? (
                            <span className="whitespace-pre-line font-bold text-xs">{message.content}</span>
                          ) : (
                            <div className="space-y-1.5">
                              {renderMarkdownBlocks(message.content)}

                              {mIndex === messages.length - 1 && !isGenerating && (
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 space-y-1.5 animate-fadeIn">
                                  <p className="text-[9px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                                    <span>💡</span> Suggested Follow-up Inquiries:
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {getFollowUpChips().map((chip) => (
                                      <button
                                        key={chip}
                                        onClick={() => handleSendMessage(chip)}
                                        className="rounded-full bg-slate-50 dark:bg-[#0E1322] border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-[9px] font-bold text-slate-700 dark:text-slate-355 hover:border-medical-blue hover:bg-medical-blue/5 hover:text-medical-blue dark:hover:text-sky-400 transition cursor-pointer shadow-sm"
                                      >
                                        {chip}
                                      </button>
                                    ))}
                                  </div>
                                  </div>
                                )}

                                {/* Clinical Disclaimer Block */}
                                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/5 text-[9px] italic text-slate-400 dark:text-slate-500 leading-normal flex gap-1">
                                  <span className="text-amber-600 dark:text-amber-500 font-extrabold shrink-0">⚖️ Disclaimer:</span>
                                  <span>This AI-generated interpretation supports clinical decision-making and should not replace evaluation by a qualified neurologist.</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Metadata row under assistant bubble */}
                          {!isUser ? (
                            <div className="flex flex-wrap items-center gap-3 px-2 text-[9px] justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-emerald-600 dark:text-emerald-450 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 leading-none tracking-wide">
                                  [{(message.model || 'Jemmi Engine').toUpperCase()}]
                                  {message.responseTime ? ` | LATENCY: ${message.responseTime}s` : ''}
                                  {message.tokensUsed ? ` | TOKENS: ~${message.tokensUsed}` : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-50 dark:bg-[#1E293B] border border-slate-200/50 dark:border-slate-800/40 text-slate-500 dark:text-slate-400 max-w-max shadow-sm animate-fadeIn">
                                {/* Group 1: Utility Actions (Copy, TTS, Regenerate) */}
                                <div className="flex items-center gap-0.5">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(message.content);
                                      toast.success('Copied text to clipboard');
                                    }}
                                    className="p-1.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-clinical-primary dark:hover:text-sky-400 transition"
                                    title="Copy Response Text"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleToggleSpeak(message.id, message.content)}
                                    className={`p-1.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition ${
                                      currentlySpeakingId === message.id ? 'text-medical-blue dark:text-sky-400 bg-slate-200/55 dark:bg-slate-800/60' : 'hover:text-clinical-primary'
                                    }`}
                                    title="Read Response Aloud"
                                  >
                                    {currentlySpeakingId === message.id && !isSpeakingPaused ? (
                                      <Pause className="h-3.5 w-3.5" />
                                    ) : (
                                      <Volume2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>

                                  {currentlySpeakingId === message.id && (
                                    <button
                                      onClick={handleStopSpeaking}
                                      className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 transition"
                                      title="Stop Voice Playback"
                                    >
                                      <StopCircle className="h-3.5 w-3.5" />
                                    </button>
                                  )}

                                  <button
                                    onClick={handleRegenerateResponse}
                                    className="p-1.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-clinical-primary dark:hover:text-sky-400 transition"
                                    title="Regenerate Response"
                                  >
                                    <MaterialIcon name="refresh" className="text-[16px]" />
                                  </button>
                                </div>

                                {/* Divider */}
                                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

                                {/* Group 2: User Feedback (Thumbs Up / Down) */}
                                <div className="flex items-center gap-0.5">
                                  <button
                                    onClick={() => handleFeedback(message.id, true)}
                                    className={`p-1.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition ${
                                      message.feedback === true ? 'text-emerald-500 bg-emerald-500/10' : 'hover:text-emerald-500'
                                    }`}
                                    title="Helpful Response"
                                  >
                                    <ThumbsUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(message.id, false)}
                                    className={`p-1.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition ${
                                      message.feedback === false ? 'text-rose-500 bg-rose-500/10' : 'hover:text-rose-500'
                                    }`}
                                    title="Unhelpful Response"
                                  >
                                    <ThumbsDown className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                {/* Divider */}
                                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

                                {/* Group 3: Message Management (Bookmark, Share, Delete) */}
                                <div className="flex items-center gap-0.5">
                                  <button
                                    onClick={() => handleToggleBookmark(message.id)}
                                    className={`p-1.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition ${
                                      bookmarkedMessageIds.has(message.id) ? 'text-amber-500 bg-amber-500/10' : 'hover:text-amber-500'
                                    }`}
                                    title="Bookmark Response"
                                  >
                                    <Star className={`h-3.5 w-3.5 ${bookmarkedMessageIds.has(message.id) ? 'fill-amber-450 text-amber-400' : ''}`} />
                                  </button>
                                  <button
                                    onClick={() => handleShareMessage(message.content)}
                                    className="p-1.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-clinical-primary dark:hover:text-sky-400 transition"
                                    title="Share Response"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500 transition"
                                    title="Delete Message"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                          // User Bubble Options: Edit message
                          <div className="flex justify-end px-2 text-[9px] text-slate-500 dark:text-slate-500 font-extrabold">
                            <button
                              onClick={() => handleEditMessage(message.content, mIndex)}
                              className="flex items-center gap-1 hover:text-medical-blue transition cursor-pointer"
                            >
                              <Edit3 className="h-2.5 w-2.5" />
                              Edit query
                            </button>
                          </div>
                        )}
                      </div>
                      {isUser && (
                        <ProfileAvatar src={photoUrl} name={user?.name} sizeClassName="h-8 w-8 shrink-0 shadow-sm" />
                      )}
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex max-w-xl flex-col gap-2 rounded-3xl rounded-tl-sm border border-slate-200 dark:border-white/5 bg-white dark:bg-[#181E32] px-4 py-3 text-xs text-slate-700 dark:text-slate-300 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Loader className="h-3.5 w-3.5 animate-spin text-medical-blue" />
                        <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wider">{staggeredStep}</span>
                      </div>
                      <div className="flex gap-1 pt-0.5">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-600" style={{ animationDelay: '0ms' }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-600" style={{ animationDelay: '150ms' }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-600" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Actions Panel */}
          {messages.length > 0 && !isLoading && (
            <div className="flex flex-wrap gap-2 px-4 py-2 border-t border-slate-200 dark:border-white/5 bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40 justify-between items-center transition">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[9px] text-slate-500 dark:text-slate-500 font-extrabold uppercase py-1">Quick Tools:</span>
                <button
                  onClick={() => handleSendMessage('Explain the previous result in extremely simple language.')}
                  className="rounded-3xl bg-white dark:bg-[#181E32] border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-[10px] font-extrabold text-slate-700 dark:text-slate-300 hover:border-medical-blue dark:hover:border-sky-400 hover:text-medical-blue transition cursor-pointer shadow-sm"
                >
                  Explain Simpler
                </button>
                <button
                  onClick={handleRegenerateResponse}
                  className="flex items-center gap-1 rounded-3xl bg-white dark:bg-[#181E32] border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-[10px] font-extrabold text-slate-700 dark:text-slate-300 hover:border-medical-blue dark:hover:border-sky-400 hover:text-medical-blue transition cursor-pointer shadow-sm"
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerate
                </button>
              </div>

              {abortControllerRef.current && (
                <button
                  onClick={handleCancelGeneration}
                  className="flex items-center gap-1 text-[10px] font-extrabold text-red-500 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 border border-red-100/40 rounded-3xl px-2.5 py-1 transition cursor-pointer shadow-sm"
                >
                  <StopCircle className="h-3.5 w-3.5 animate-pulse" />
                  Stop Generating
                </button>
              )}
            </div>
          )}

          {/* File Attachment Preview */}
          {attachedFile && (
            <div className="px-4 py-2 border-t border-slate-200 dark:border-white/5 bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-medical-blue" />
                <span className="truncate max-w-xs">{attachedFile.name}</span>
                <span className="text-[10px] text-slate-500 font-bold">({attachedFile.type})</span>
              </div>
              <button
                onClick={() => setAttachedFile(null)}
                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-[#0E1322] text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Input text box */}
          <div className="p-3 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-[#0E1322] flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".txt,.csv,.pdf,.png,.jpg,.jpeg"
            />

            <button
              onClick={handleFileAttach}
              disabled={isLoading || isGenerating}
              className="p-3 rounded-3xl bg-slate-100/75 dark:bg-[#0E1322] text-slate-500 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-[#0E1322] disabled:opacity-50 transition cursor-pointer shadow-sm border border-transparent dark:border-white/5"
              title="Attach Document / Brain MRI Image"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <button
              onClick={handleToggleRecording}
              disabled={isLoading || isGenerating}
              className={`p-3 rounded-3xl disabled:opacity-50 transition cursor-pointer shadow-sm border border-transparent dark:border-white/5 ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-slate-100/75 dark:bg-[#0E1322] text-slate-500 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-[#0E1322]'
              }`}
              title={isRecording ? 'Stop Recording' : 'Start Speech Input'}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <div className="flex-1 relative flex items-center">
              {activeSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-[#181E32] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-30 max-h-[200px] overflow-y-auto custom-scrollbar animate-fadeIn">
                  {activeSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        handleSendMessage(suggestion);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#0E1322] font-bold text-xs text-slate-705 dark:text-slate-200 border-b border-slate-100 dark:border-white/5 last:border-0 transition cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(input)}
                disabled={isLoading || isGenerating}
                className="w-full rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#181E32] pl-4 pr-12 py-3 text-xs outline-none placeholder:text-slate-500 dark:placeholder:text-slate-500 focus:border-slate-300 dark:focus:border-slate-800 dark:text-white disabled:opacity-50 font-bold transition-all shadow-sm"
                placeholder={isRecording ? 'Listening voice commands...' : 'Ask Jemmi AI about dementia or report highlights...'}
                aria-label="Clinical prompt"
              />
              {isRecording && (
                <div className="absolute right-3.5 flex items-center gap-0.5">
                  <span className="h-2.5 w-0.5 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-4 w-0.5 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2.5 w-0.5 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>

            <button
              onClick={() => handleSendMessage(input)}
              disabled={isLoading || isGenerating || (!input.trim() && !attachedFile)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-gradient-to-r from-sky-500 to-medical-blue text-white shadow-md shadow-sky-500/10 hover:opacity-95 disabled:opacity-30 disabled:shadow-none cursor-pointer active:scale-95 transition"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
