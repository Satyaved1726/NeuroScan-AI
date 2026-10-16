import { ChangeEvent, FormEvent, useCallback, useEffect, useState, useMemo } from 'react';
import MaterialIcon from '../components/MaterialIcon';

const Camera = ({ className }: { className?: string }) => <MaterialIcon name="photo_camera" className={className} />;
const FileText = ({ className }: { className?: string }) => <MaterialIcon name="description" className={className} />;
const Save = ({ className }: { className?: string }) => <MaterialIcon name="save" className={className} />;
const Trash2 = ({ className }: { className?: string }) => <MaterialIcon name="delete" className={className} />;
const UserRound = ({ className }: { className?: string }) => <MaterialIcon name="person" className={className} />;
const Bell = ({ className }: { className?: string }) => <MaterialIcon name="notifications" className={className} />;
const Sliders = ({ className }: { className?: string }) => <MaterialIcon name="settings" className={className} />;
const History = ({ className }: { className?: string }) => <MaterialIcon name="history" className={className} />;
const ShieldCheck = ({ className }: { className?: string }) => <MaterialIcon name="admin_panel_settings" className={className} />;
const UserCircle2 = ({ className }: { className?: string }) => <MaterialIcon name="account_circle" className={className} />;
const AlertCircle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { useToastContext } from '../hooks/useToastContext';
import { useDarkMode } from '../hooks/useDarkMode';
import { useNotifications } from '../contexts/NotificationContext';
import ProfileAvatar from '../components/ProfileAvatar';
import ConfirmModal from '../components/ConfirmModal';
import SkeletonLoader from '../components/SkeletonLoader';
import {
  createPatientProfile,
  deletePatientProfilePhoto,
  deletePatientProfile,
  fetchPatientProfile,
  updatePatientProfile,
  uploadPatientProfilePhoto,
} from '../services/profileService';
import { getUserFriendlyMessage, normalizeError } from '../utils/errorHandler';
import type { PatientProfile, PatientProfilePayload } from '../types';

interface MetadataFields {
  aadhaar?: string;
  surgeries?: string;
  smoking?: string;
  alcohol?: string;
  diabetes?: string;
  hypertension?: string;
  emergency_contact_relationship?: string;
  emergency_contact_address?: string;
  assigned_doctor?: string;
}

type ProfileForm = Record<keyof PatientProfilePayload, string> & { patient_id: string } & MetadataFields;

const emptyForm: ProfileForm = {
  patient_id: '',
  full_name: '',
  gender: '',
  dob: '',
  age: '',
  phone: '',
  email: '',
  blood_group: '',
  height: '',
  weight: '',
  allergies: '',
  medications: '',
  medical_history: '',
  family_history: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  aadhaar: '',
  surgeries: '',
  smoking: '',
  alcohol: '',
  diabetes: '',
  hypertension: '',
  emergency_contact_relationship: '',
  emergency_contact_address: '',
  assigned_doctor: '',
};

const bloodGroups = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const genders = ['', 'Female', 'Male', 'Non-binary', 'Prefer not to say'];
const smokingOptions = ['', 'None', 'Occasional', 'Regular'];
const alcoholOptions = ['', 'None', 'Occasional', 'Regular'];
const booleanOptions = ['', 'No', 'Yes'];
const relationshipOptions = ['', 'Spouse', 'Child', 'Sibling', 'Parent', 'Guardian', 'Other'];
const avatarCropSize = 320;

function generatePatientId(): string {
  const chars = '0123456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `NSA-${rand}`;
}

function extractMetadata(medicalHistory: string | null): { historyText: string; metadata: MetadataFields } {
  if (!medicalHistory) return { historyText: '', metadata: {} };
  const parts = medicalHistory.split('\n\n--CLINICAL_METADATA--\n');
  if (parts.length < 2) return { historyText: medicalHistory, metadata: {} };
  try {
    return {
      historyText: parts[0],
      metadata: JSON.parse(parts[1])
    };
  } catch {
    return { historyText: medicalHistory, metadata: {} };
  }
}

function toForm(profile: PatientProfile | null): ProfileForm {
  if (!profile) {
    return {
      ...emptyForm,
      patient_id: generatePatientId(),
    };
  }
  const { historyText, metadata } = extractMetadata(profile.medical_history ?? null);

  return {
    patient_id: profile.patient_id || generatePatientId(),
    full_name: profile.full_name ?? '',
    gender: profile.gender ?? '',
    dob: profile.dob ? profile.dob.slice(0, 10) : '',
    age: profile.age != null ? String(profile.age) : '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    blood_group: profile.blood_group ?? '',
    height: profile.height != null ? String(profile.height) : '',
    weight: profile.weight != null ? String(profile.weight) : '',
    allergies: profile.allergies ?? '',
    medications: profile.medications ?? '',
    medical_history: historyText ?? '',
    family_history: profile.family_history ?? '',
    emergency_contact_name: profile.emergency_contact_name ?? '',
    emergency_contact_phone: profile.emergency_contact_phone ?? '',
    aadhaar: metadata.aadhaar ?? '',
    surgeries: metadata.surgeries ?? '',
    smoking: metadata.smoking ?? '',
    alcohol: metadata.alcohol ?? '',
    diabetes: metadata.diabetes ?? '',
    hypertension: metadata.hypertension ?? '',
    emergency_contact_relationship: metadata.emergency_contact_relationship ?? '',
    emergency_contact_address: metadata.emergency_contact_address ?? '',
    assigned_doctor: metadata.assigned_doctor ?? '',
  };
}

function toPayload(form: ProfileForm, assignedDoctor: string): PatientProfilePayload {
  const metadata: MetadataFields = {
    aadhaar: form.aadhaar?.trim() || undefined,
    surgeries: form.surgeries?.trim() || undefined,
    smoking: form.smoking || undefined,
    alcohol: form.alcohol || undefined,
    diabetes: form.diabetes || undefined,
    hypertension: form.hypertension || undefined,
    emergency_contact_relationship: form.emergency_contact_relationship || undefined,
    emergency_contact_address: form.emergency_contact_address?.trim() || undefined,
    assigned_doctor: assignedDoctor || undefined,
  };
  const metadataBlock = `\n\n--CLINICAL_METADATA--\n${JSON.stringify(metadata)}`;

  return {
    full_name: form.full_name.trim(),
    gender: form.gender.trim() || null,
    dob: form.dob || null,
    age: form.age ? Number(form.age) : null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    blood_group: form.blood_group.trim() || null,
    height: form.height ? Number(form.height) : null,
    weight: form.weight ? Number(form.weight) : null,
    allergies: form.allergies.trim() || null,
    medications: form.medications.trim() || null,
    medical_history: form.medical_history.trim() + metadataBlock,
    family_history: form.family_history.trim() || null,
    emergency_contact_name: form.emergency_contact_name.trim() || null,
    emergency_contact_phone: form.emergency_contact_phone.trim() || null,
  };
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="clinical-label">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="clinical-input"
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="block">
      <span className="clinical-label">{label}</span>
      <div className="mt-1.5 flex items-center rounded-lg border border-clinical-border dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400">
        {value}
      </div>
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="clinical-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="clinical-select"
      >
        {options.map((option) => (
          <option key={option || 'empty'} value={option}>
            {option || placeholder}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="clinical-label">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="clinical-textarea"
      />
    </label>
  );
}

function imageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read profile photo'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load profile photo'));
    image.src = src;
  });
}

async function cropAvatarToFile(src: string, zoom: number, offsetX: number, offsetY: number): Promise<File> {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = avatarCropSize;
  canvas.height = avatarCropSize;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to prepare image crop');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, avatarCropSize, avatarCropSize);
  const baseScale = Math.max(avatarCropSize / image.width, avatarCropSize / image.height);
  const scaledWidth = image.width * baseScale * zoom;
  const scaledHeight = image.height * baseScale * zoom;
  const dx = (avatarCropSize - scaledWidth) / 2 + offsetX;
  const dy = (avatarCropSize - scaledHeight) / 2 + offsetY;
  context.drawImage(image, dx, dy, scaledWidth, scaledHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) {
        resolve(nextBlob);
      } else {
        reject(new Error('Unable to export profile photo'));
      }
    }, 'image/png', 0.92);
  });

  return new File([blob], 'profile-photo.png', { type: 'image/png' });
}

export default function ProfilePage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { photoUrl, setPhotoUrl } = useProfilePhoto();
  const { success: showSuccessToast, error: showErrorToast } = useToastContext();
  const { isDark, toggleDarkMode } = useDarkMode();
  const { addNotification } = useNotifications();

  const doctorsList = useMemo(() => [
    'Dr. Sarah Jenkins (Neurology)',
    'Dr. David Carter (Neuro-radiology)',
    'Dr. Alan Mercer (Geriatric Specialist)',
    'Dr. Lisa Vance (Cognitive Disorders)',
  ], []);

  const [assignedDoctor, setAssignedDoctor] = useState<string>(() => {
    return localStorage.getItem(`neuroscan_assigned_doctor_${user?.id}`) || '';
  });

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [originalForm, setOriginalForm] = useState<ProfileForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPhotoSaving, setIsPhotoSaving] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showDeleteProfileConfirm, setShowDeleteProfileConfirm] = useState(false);
  const [showDeletePhotoConfirm, setShowDeletePhotoConfirm] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasChanged = Object.keys(emptyForm).some(
        (key) => (form[key as keyof ProfileForm] || '') !== (originalForm[key as keyof ProfileForm] || '')
      );
      if (hasChanged) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [form, originalForm]);

  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const bmiInfo = useMemo(() => {
    const h = parseFloat(form.height);
    const w = parseFloat(form.weight);
    if (!h || !w || h <= 0 || w <= 0) return null;

    const bmiVal = w / ((h / 100) ** 2);
    let category = 'Normal';
    let colorClass = 'bg-clinical-status-normal/10 text-clinical-status-normal border border-clinical-status-normal/20';

    if (bmiVal < 18.5) {
      category = 'Underweight';
      colorClass = 'bg-[#3A82F7]/10 text-[#3A82F7] border border-[#3A82F7]/20';
    } else if (bmiVal >= 18.5 && bmiVal <= 24.9) {
      category = 'Normal weight';
      colorClass = 'bg-clinical-status-normal/10 text-clinical-status-normal border border-clinical-status-normal/20';
    } else if (bmiVal >= 25 && bmiVal <= 29.9) {
      category = 'Overweight';
      colorClass = 'bg-clinical-status-warning/10 text-clinical-status-warning border border-clinical-status-warning/20';
    } else {
      category = 'Obese';
      colorClass = 'bg-clinical-status-critical/10 text-clinical-status-critical border border-clinical-status-critical/20';
    }

    return {
      value: bmiVal.toFixed(1),
      category,
      colorClass
    };
  }, [form.height, form.weight]);

  const [activeTab, setActiveTab] = useState<'info' | 'medical' | 'security' | 'preferences' | 'logs'>('info');

  const loadProfile = useCallback(
    async ({ showLoader = true }: { showLoader?: boolean } = {}) => {
      if (showLoader) {
        setIsLoading(true);
      }
      setError(null);

      const nextProfile = await fetchPatientProfile();
      setProfile(nextProfile);
      const initialForm = toForm(nextProfile);
      setForm(initialForm);
      setOriginalForm(initialForm);
      setPhotoUrl(nextProfile?.photo_url ?? null);

      if (showLoader) {
        setIsLoading(false);
      }

      return nextProfile;
    },
    [setPhotoUrl],
  );

  useEffect(() => {
    let isMounted = true;
    if (!isAuthLoading && user) {
      loadProfile().catch((err) => {
        if (isMounted) {
          const message = getUserFriendlyMessage(normalizeError(err));
          setError(message);
          showErrorToast(message);
          setIsLoading(false);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, loadProfile, showErrorToast, user]);

  const setField = (field: keyof ProfileForm, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'dob' && value) {
        const birthDate = new Date(value);
        const today = new Date();
        if (!isNaN(birthDate.getTime())) {
          let calculatedAge = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            calculatedAge--;
          }
          if (calculatedAge >= 0 && calculatedAge <= 120) {
            next.age = String(calculatedAge);
          }
        }
      }
      return next;
    });
  };

  const validateForm = () => {
    if (!form.full_name.trim()) {
      return 'Full Name is required.';
    }
    if (form.age && (Number(form.age) < 1 || Number(form.age) > 120)) {
      return 'Please enter a valid age between 1 and 120.';
    }
    if (form.height && (Number(form.height) < 40 || Number(form.height) > 250)) {
      return 'Please enter a valid height between 40cm and 250cm.';
    }
    if (form.weight && (Number(form.weight) < 2 || Number(form.weight) > 350)) {
      return 'Please enter a valid weight between 2kg and 350kg.';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (form.dob) {
      const birthDate = new Date(form.dob);
      const today = new Date();
      if (birthDate > today) {
        return 'Date of Birth cannot be in the future.';
      }
    }
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateForm();
    if (validation) {
      showErrorToast(validation);
      return;
    }

    try {
      setIsSaving(true);
      const payload = toPayload(form, assignedDoctor);
      if (!payload.full_name) {
        payload.full_name = user?.name.trim() || 'Patient Profile';
      }
      const hadProfile = Boolean(profile);
      await (hadProfile ? updatePatientProfile(payload) : createPatientProfile(payload));
      await loadProfile({ showLoader: false });
      if (assignedDoctor) {
        localStorage.setItem(`neuroscan_assigned_doctor_${user?.id}`, assignedDoctor);
      }
      showSuccessToast(hadProfile ? 'Profile saved' : 'Profile created');
      addNotification(
        'success',
        'Profile Updated',
        'Clinician profile settings and medical signature preferences successfully updated.'
      );
    } catch (err) {
      showErrorToast(getUserFriendlyMessage(normalizeError(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!profile) return;
    setShowDeleteProfileConfirm(true);
  };

  const handleConfirmDeleteProfile = async () => {
    setShowDeleteProfileConfirm(false);
    try {
      setIsSaving(true);
      await deletePatientProfile();
      setProfile(null);
      setForm(emptyForm);
      showSuccessToast('Patient profile deleted');
    } catch (err) {
      showErrorToast(getUserFriendlyMessage(normalizeError(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showErrorToast('Choose an image file for the profile photo.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showErrorToast('Profile photo must be smaller than 5 MB.');
      return;
    }

    try {
      setSelectedPhoto(await imageFileToDataUrl(file));
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
    } catch (err) {
      showErrorToast(getUserFriendlyMessage(normalizeError(err)));
    }
  };

  const handleUploadPhoto = async () => {
    if (!selectedPhoto) return;

    try {
      setIsPhotoSaving(true);
      const croppedFile = await cropAvatarToFile(selectedPhoto, cropZoom, cropOffsetX, cropOffsetY);
      const updatedProfile = await uploadPatientProfilePhoto(croppedFile);
      setProfile(updatedProfile);
      setForm(toForm(updatedProfile));
      setPhotoUrl(updatedProfile.photo_url ?? null);
      setSelectedPhoto(null);
      showSuccessToast('Profile photo updated');
      addNotification(
        'success',
        'Profile Updated',
        'Clinician profile avatar and signing token image successfully saved.'
      );
    } catch (err) {
      showErrorToast(getUserFriendlyMessage(normalizeError(err)));
    } finally {
      setIsPhotoSaving(false);
    }
  };

  const handleDeletePhoto = () => {
    if (!photoUrl && !profile?.photo_url) return;
    setShowDeletePhotoConfirm(true);
  };

  const handleConfirmDeletePhoto = async () => {
    setShowDeletePhotoConfirm(false);
    try {
      setIsPhotoSaving(true);
      const updatedProfile = await deletePatientProfilePhoto();
      setProfile(updatedProfile);
      setForm(toForm(updatedProfile));
      setPhotoUrl(null);
      setSelectedPhoto(null);
      showSuccessToast('Profile photo deleted');
    } catch (err) {
      showErrorToast(getUserFriendlyMessage(normalizeError(err)));
    } finally {
      setIsPhotoSaving(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return <SkeletonLoader type="profile" />;
  }

  if (!user) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <span className="text-xs font-bold text-red-400">Please authenticate your session to view options.</span>
      </div>
    );
  }

  const mrn = form.patient_id ? `MRN-${form.patient_id.replace('NSA-', '')}` : 'MRN-DRAFT';
  const hrn = form.patient_id ? `HRN-${form.patient_id.replace('NSA-', '')}` : 'HRN-DRAFT';
  const registrationTimestamp = profile?.created_at ? new Date(profile.created_at).toLocaleString() : new Date().toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6">

      {/* 1. Header Banner Panel */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-[#181E32] p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
        <div className="relative group rounded-full overflow-hidden h-20 w-20 border-2 border-slate-200 dark:border-white/5 shadow-sm flex-shrink-0 cursor-pointer">
          <ProfileAvatar src={photoUrl} name={form.full_name || user.name} sizeClassName="h-full w-full" className="text-2xl font-bold" />
          <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
            <Camera className="h-5 w-5 text-white" />
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoSelect} className="sr-only" />
          </label>
        </div>

        <div className="flex-1 min-w-0 text-center md:text-left space-y-1">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white truncate">
              {form.full_name || user.name}
            </h2>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-extrabold bg-medical-blue/10 text-medical-blue border border-clinical-primary/20 uppercase tracking-wider">
              {user.role}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-semibold">{user.email}</p>
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">
            Patient ID: {form.patient_id || 'NSA-DRAFT-PROV'}
          </p>
        </div>

        {photoUrl && (
          <button
            type="button"
            onClick={handleDeletePhoto}
            disabled={isPhotoSaving}
            className="md:ml-auto text-xs font-bold text-red-500 hover:text-red-400 flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="h-4 w-4" /> Delete Photo
          </button>
        )}
      </div>

      {/* Photo Crop Subpanel overlay */}
      {selectedPhoto && (
        <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-[#F5F8FC] dark:bg-[#0E1322] p-6 space-y-4 shadow-inner">
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="mx-auto h-36 w-36 overflow-hidden rounded-full border-4 border-white bg-white shadow-sm flex-shrink-0">
              <div
                className="h-full w-full bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${selectedPhoto})`,
                  backgroundSize: `${cropZoom * 100}%`,
                  backgroundPosition: `calc(50% + ${cropOffsetX}px) calc(50% + ${cropOffsetY}px)`,
                }}
              />
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Camera className="h-4 w-4 text-medical-blue" /> Adjust Crop Bounds
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Zoom</span>
                  <input type="range" min="1" max="2.5" step="0.05" value={cropZoom} onChange={(e) => setCropZoom(Number(e.target.value))} className="mt-1 w-full" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Horizontal</span>
                  <input type="range" min="-80" max="80" step="1" value={cropOffsetX} onChange={(e) => setCropOffsetX(Number(e.target.value))} className="mt-1 w-full" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Vertical</span>
                  <input type="range" min="-80" max="80" step="1" value={cropOffsetY} onChange={(e) => setCropOffsetY(Number(e.target.value))} className="mt-1 w-full" />
                </label>
              </div>
              <div className="flex justify-end gap-2 text-xs font-bold">
                <button type="button" onClick={() => setSelectedPhoto(null)} className="px-4 py-2 border border-slate-200 rounded-3xl hover:bg-white text-slate-655 bg-white">Cancel</button>
                <button type="button" onClick={handleUploadPhoto} disabled={isPhotoSaving} className="px-4 py-2 bg-clinical-secondary border border-clinical-secondary rounded-3xl text-white">Save Photo</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Workspace Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-white/5 flex flex-wrap gap-2 text-xs font-bold text-slate-500 tracking-wide uppercase">
        {[
          { id: 'info', label: 'Personal Info', icon: UserRound },
          { id: 'medical', label: 'Medical Background', icon: FileText },
          { id: 'security', label: 'Security & Session', icon: ShieldCheck },
          { id: 'preferences', label: 'Preferences', icon: Sliders },
          { id: 'logs', label: 'Activity Log', icon: History }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-clinical-primary text-slate-900 dark:text-white'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Dynamic Tab Content Cards */}
      <div className="bg-white dark:bg-[#181E32] border border-slate-200/60 dark:border-slate-800/85 rounded-3xl p-6 shadow-sm min-h-[300px]">
        {activeTab === 'info' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Basic Identification</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Edit patient profile attributes</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Patient ID" value={form.patient_id || 'NSA-DRAFT-PROV'} />
              <TextInput label="Full Name" value={form.full_name} onChange={(val) => setField('full_name', val)} />
              <SelectInput label="Gender" value={form.gender} onChange={(val) => setField('gender', val)} options={genders} placeholder="Select gender" />
              <TextInput label="Date of Birth" type="date" value={form.dob} onChange={(val) => setField('dob', val)} />
              <TextInput label="Primary Phone" value={form.phone} onChange={(val) => setField('phone', val)} placeholder="e.g. +91 99480 00000" />
              <TextInput label="Primary Email" type="email" value={form.email} onChange={(val) => setField('email', val)} placeholder="name@domain.com" />
              <SelectInput
                label="Assigned Doctor / Radiologist"
                value={assignedDoctor}
                onChange={(val) => setAssignedDoctor(val)}
                options={['', ...doctorsList]}
                placeholder="Assign a clinician"
              />
              <TextInput label="Aadhaar / Government ID (Optional)" value={form.aadhaar || ''} onChange={(val) => setField('aadhaar', val)} placeholder="e.g. 1234-5678-9012" />
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-white/5 space-y-4">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Hospital & PACS Registry Tags</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">Auto-generated diagnostic system identifiers</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <ReadOnlyField label="Medical Record Number (MRN)" value={mrn} />
                <ReadOnlyField label="Hospital Registration ID" value={hrn} />
                <ReadOnlyField label="PACS Registry Timestamp" value={registrationTimestamp} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'medical' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Clinical Parameters</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Specify health metrics and emergency contacts</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectInput label="Blood Group" value={form.blood_group} onChange={(val) => setField('blood_group', val)} options={bloodGroups} placeholder="Select blood group" />
              <TextInput label="Age" type="number" value={form.age} onChange={(val) => setField('age', val)} />
              <TextInput label="Height (cm)" type="number" value={form.height} onChange={(val) => setField('height', val)} placeholder="cm" />
              <TextInput label="Weight (kg)" type="number" value={form.weight} onChange={(val) => setField('weight', val)} placeholder="kg" />

              <div className="flex flex-col justify-end pb-1 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-clinical p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Calculated BMI Rating</span>
                {bmiInfo ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white leading-none">{bmiInfo.value}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${bmiInfo.colorClass} leading-none`}>
                      {bmiInfo.category}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-slate-405 mt-1.5 block">Provide Height & Weight</span>
                )}
              </div>

              <TextInput label="Emergency Contact Name" value={form.emergency_contact_name} onChange={(val) => setField('emergency_contact_name', val)} />
              <TextInput label="Emergency Contact Phone" value={form.emergency_contact_phone} onChange={(val) => setField('emergency_contact_phone', val)} />
              <SelectInput label="Emergency Contact Relationship" value={form.emergency_contact_relationship || ''} onChange={(val) => setField('emergency_contact_relationship', val)} options={relationshipOptions} placeholder="Select relationship" />
              <TextInput label="Emergency Contact Address" value={form.emergency_contact_address || ''} onChange={(val) => setField('emergency_contact_address', val)} placeholder="Contact full address" />
              <SelectInput label="Smoking Habit" value={form.smoking || ''} onChange={(val) => setField('smoking', val)} options={smokingOptions} placeholder="Smoking status" />
              <SelectInput label="Alcohol Habit" value={form.alcohol || ''} onChange={(val) => setField('alcohol', val)} options={alcoholOptions} placeholder="Alcohol status" />
              <SelectInput label="Diabetes Status" value={form.diabetes || ''} onChange={(val) => setField('diabetes', val)} options={booleanOptions} placeholder="Diabetes diagnosed?" />
              <SelectInput label="Hypertension Status" value={form.hypertension || ''} onChange={(val) => setField('hypertension', val)} options={booleanOptions} placeholder="Hypertension diagnosed?" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 pt-4 border-t border-slate-200 dark:border-white/5">
              <TextArea label="Clinical Notes / Medical History" value={form.medical_history} onChange={(val) => setField('medical_history', val)} />
              <TextArea label="Current Medications List" value={form.medications} onChange={(val) => setField('medications', val)} />
              <TextArea label="Known Allergies" value={form.allergies} onChange={(val) => setField('allergies', val)} />
              <TextArea label="Family Disease History" value={form.family_history} onChange={(val) => setField('family_history', val)} />
              <TextArea label="Previous Surgeries Description" value={form.surgeries || ''} onChange={(val) => setField('surgeries', val)} />
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Account Security & Role</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Manage credentials and authentication parameters</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <ReadOnlyField label="Account Login Name" value={user.name} />
              <ReadOnlyField label="Account Email" value={user.email} />
              <ReadOnlyField label="Professional Role" value={user.role} />
            </div>
            <div className="pt-4 border-t border-slate-200 dark:border-white/5 space-y-4">
              <div className="flex items-center justify-between text-xs font-bold">
                <div>
                  <p className="text-slate-900 dark:text-white">Active Login Sessions</p>
                  <p className="text-slate-500 font-semibold mt-0.5">Chrome on Windows (Hyderabad, India)</p>
                </div>
                <button type="button" className="px-4 py-2 border border-slate-200 dark:border-white/5 rounded-3xl hover:bg-[#F5F8FC] dark:hover:bg-[#0E1322] text-slate-700 dark:text-slate-500 transition">Revoke Sessions</button>
              </div>
            </div>
            {profile && (
              <div className="pt-4 border-t border-red-100 dark:border-red-950/20 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-red-650">Danger Zone: Delete patient profile</p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Removes the saved medical records linked to this account from the database.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="px-4 py-2 bg-white border border-red-200 rounded-3xl text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Trash2 className="h-4 w-4" /> Delete Clinical Record
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Appearance & Workspace</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Configure theme preferences for clinical diagnostics</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-3xl bg-[#F5F8FC] dark:bg-[#0E1322] border border-slate-200 dark:border-white/5">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Display Theme</span>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Select interface theme background color</p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isDark) toggleDarkMode();
                      showSuccessToast('Switched to Dark Mode');
                    }}
                    className={`px-4 py-1.5 rounded-3xl text-xs font-bold border transition ${
                      isDark ? 'bg-medical-blue border-clinical-primary text-white' : 'bg-white border-slate-200 dark:bg-[#0E1322] dark:border-slate-800 text-slate-700 dark:text-slate-500'
                    }`}
                  >
                    Dark Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isDark) toggleDarkMode();
                      showSuccessToast('Switched to Light Mode');
                    }}
                    className={`px-4 py-1.5 rounded-3xl text-xs font-bold border transition ${
                      !isDark ? 'bg-medical-blue border-clinical-primary text-white' : 'bg-white border-slate-200 dark:bg-[#0E1322] dark:border-slate-800 text-slate-700 dark:text-slate-500'
                    }`}
                  >
                    Light Mode
                  </button>
                </div>
              </div>
              <div className="p-4 rounded-3xl bg-[#F5F8FC] dark:bg-[#0E1322] border border-slate-200 dark:border-white/5">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Workspace Alerts</span>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Toggles email alerts when new reports are compiled</p>
                <div className="mt-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
                    <input type="checkbox" defaultChecked className="h-4 w-4 text-medical-blue accent-clinical-primary cursor-pointer" />
                    Notify on critical scans flags
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Workspace Audit Trail</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Audit history details for login and report actions</p>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {[
                { time: 'Active Now', act: 'Session authorized on clinical endpoint.', icon: ShieldCheck },
                { time: '10 min ago', act: 'Patient record data synchronized.', icon: FileText },
                { time: 'Yesterday', act: 'Login successful via credential token.', icon: UserCircle2 }
              ].map((log, idx) => (
                <div key={idx} className="flex justify-between items-center py-2.5 px-4 rounded-3xl border border-slate-200 dark:border-white/5 bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40">
                  <div className="flex items-center gap-3">
                    <log.icon className="h-4 w-4 text-slate-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{log.act}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Action Save Bar */}
      <div className="sticky bottom-4 z-10 flex justify-end items-center gap-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-[#0E1322]/90 p-4 shadow-lg backdrop-blur-md">

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-3xl bg-medical-blue px-6 py-2.5 text-xs font-bold text-white transition hover:bg-medical-blue/95 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
        </button>
      </div>
    </form>
    <ConfirmModal
        isOpen={showDeleteProfileConfirm}
        title="Delete Patient Profile"
        message="Are you sure you want to permanently delete your clinical patient profile metadata? This action is irreversible."
        confirmLabel="Delete Profile"
        onConfirm={handleConfirmDeleteProfile}
        onCancel={() => setShowDeleteProfileConfirm(false)}
        isDanger
      />
      <ConfirmModal
        isOpen={showDeletePhotoConfirm}
        title="Delete Profile Photo"
        message="Are you sure you want to delete your profile photo avatar?"
        confirmLabel="Delete Avatar"
        onConfirm={handleConfirmDeletePhoto}
        onCancel={() => setShowDeletePhotoConfirm(false)}
        isDanger
      />
    </motion.div>
  );
}
