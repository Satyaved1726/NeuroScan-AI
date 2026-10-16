import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import MaterialIcon from '../components/MaterialIcon';

const Calendar = ({ className }: { className?: string }) => <MaterialIcon name="calendar_today" className={className} />;
const Download = ({ className }: { className?: string }) => <MaterialIcon name="download" className={className} />;
const HeartPulse = ({ className }: { className?: string }) => <MaterialIcon name="monitoring" className={className} />;
const User = ({ className }: { className?: string }) => <MaterialIcon name="person" className={className} />;
const ArrowLeft = ({ className }: { className?: string }) => <MaterialIcon name="arrow_back" className={className} />;
import { motion } from 'framer-motion';
import { useToastContext } from '../hooks/useToastContext';
import { downloadReportPdf } from '../services/reportService';
import { fetchPatientProfile } from '../services/profileService';
import { normalizeError, getUserFriendlyMessage } from '../utils/errorHandler';

interface ScanItem {
  id: string;
  scanId: string;
  date: string;
  prediction: string;
  confidence: number;
  risk: string;
  reportId?: string;
}

export default function PatientProfilePage() {
  const params = useParams<{ id: string }>();
  const toast = useToastContext();

  const [isLoading, setIsLoading] = useState(true);
  const [isReportDownloading, setIsReportDownloading] = useState(false);

  // Mock patient dataset
  const patientData = {
    id: params.id || 'NSA-7429',
    name: 'John Doe',
    age: 68,
    gender: 'Male',
    dob: '1958-04-12',
    bloodGroup: 'O+',
    phone: '+1 (555) 382-9904',
    email: 'j.doe@clinicalvault.org',
    emergencyName: 'Mary Doe',
    emergencyPhone: '+1 (555) 382-9912',
    medications: 'Donepezil 10mg QD, Vitamin D3 2000IU QD',
    allergies: 'Penicillin (Moderate rash reaction)',
    historyNotes: 'Patient presented with progressive short-term memory decline over 14 months. Family history of late-onset Alzheimer disease. Mini-Mental State Examination (MMSE) score: 22/30.',
    scans: [
      {
        id: '1',
        scanId: 'scan-104',
        date: '2026-06-15T10:30:00Z',
        prediction: 'Mild Demented',
        confidence: 84.5,
        risk: 'High',
        reportId: 'rep-8812',
      },
      {
        id: '2',
        scanId: 'scan-102',
        date: '2025-12-08T14:15:00Z',
        prediction: 'Very Mild Demented',
        confidence: 76.2,
        risk: 'Medium',
        reportId: 'rep-7421',
      },
      {
        id: '3',
        scanId: 'scan-101',
        date: '2025-06-02T09:45:00Z',
        prediction: 'Non Demented',
        confidence: 91.8,
        risk: 'Low',
        reportId: 'rep-6104',
      }
    ] as ScanItem[]
  };

  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await fetchPatientProfile();
        setProfile(data);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  const extractMetadata = (medicalHistory: string | null) => {
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
  };

  const { historyText, metadata } = extractMetadata(profile?.medical_history ?? null);

  const id = profile?.patient_id || patientData.id;
  const name = profile?.full_name || patientData.name;
  const age = profile?.age != null ? profile.age : patientData.age;
  const gender = profile?.gender || patientData.gender;
  const dob = profile?.dob ? profile.dob.slice(0, 10) : patientData.dob;
  const bloodGroup = profile?.blood_group || patientData.bloodGroup;
  const phone = profile?.phone || patientData.phone;
  const email = profile?.email || patientData.email;
  const emergencyName = profile?.emergency_contact_name || patientData.emergencyName;
  const emergencyPhone = profile?.emergency_contact_phone || patientData.emergencyPhone;
  const medications = profile?.medications || patientData.medications;
  const allergies = profile?.allergies || patientData.allergies;
  const historyNotes = historyText || patientData.historyNotes;
  const scans = patientData.scans;

  // Metadata Custom fields
  const aadhaar = metadata?.aadhaar || 'Not Provided';
  const surgeries = metadata?.surgeries || 'No previous surgical history reported.';
  const smoking = metadata?.smoking || 'None';
  const alcohol = metadata?.alcohol || 'None';
  const diabetes = metadata?.diabetes || 'No';
  const hypertension = metadata?.hypertension || 'No';
  const emergencyRelationship = metadata?.emergency_contact_relationship || 'Spouse';
  const emergencyAddress = metadata?.emergency_contact_address || 'Not Provided';
  const assignedDoctor = metadata?.assigned_doctor || 'Dr. Sarah Jenkins';

  const hVal = profile?.height ? Number(profile.height) : 174;
  const wVal = profile?.weight ? Number(profile.weight) : 71;
  const bmiValue = (wVal / ((hVal / 100) ** 2)).toFixed(1);
  let bmiCategory = 'Normal weight';
  let bmiColorClass = 'bg-clinical-status-normal/10 text-clinical-status-normal border border-clinical-status-normal/20';
  const bmiNum = Number(bmiValue);
  if (bmiNum < 18.5) {
    bmiCategory = 'Underweight';
    bmiColorClass = 'bg-[#3A82F7]/10 text-[#3A82F7] border border-[#3A82F7]/20';
  } else if (bmiNum >= 18.5 && bmiNum <= 24.9) {
    bmiCategory = 'Normal weight';
    bmiColorClass = 'bg-clinical-status-normal/10 text-clinical-status-normal border border-clinical-status-normal/20';
  } else if (bmiNum >= 25 && bmiNum <= 29.9) {
    bmiCategory = 'Overweight';
    bmiColorClass = 'bg-clinical-status-warning/10 text-clinical-status-warning border border-clinical-status-warning/20';
  } else {
    bmiCategory = 'Obese';
    bmiColorClass = 'bg-clinical-status-critical/10 text-clinical-status-critical border border-clinical-status-critical/20';
  }

  // Hospital PACS Derived fields
  const mrn = id ? `MRN-${id.replace('NSA-', '')}` : 'MRN-7429';
  const hrn = id ? `HRN-${id.replace('NSA-', '')}` : 'HRN-7429';
  const registrationTimestamp = profile?.created_at ? new Date(profile.created_at).toLocaleString() : '2026-06-01 09:30 AM';

  const handleDownloadReport = async (reportId: string) => {
    try {
      setIsReportDownloading(true);
      const report = await downloadReportPdf(reportId);
      const url = URL.createObjectURL(report);
      const link = document.createElement('a');
      link.href = url;
      link.download = `neuroscan-report-${reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Clinical report downloaded successfully');
    } catch (err) {
      const errorInfo = normalizeError(err);
      toast.error(getUserFriendlyMessage(errorInfo));
    } finally {
      setIsReportDownloading(false);
    }
  };

  const chartData = [...scans].reverse().map(scan => ({
    date: new Date(scan.date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
    confidence: scan.confidence,
    riskScore: scan.risk.toLowerCase() === 'high' ? 80 : scan.risk.toLowerCase() === 'medium' ? 50 : 20,
  }));

  const getStatusTextStyle = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'text-clinical-status-critical font-semibold';
      case 'medium':
      case 'moderate':
        return 'text-clinical-status-warning font-semibold';
      case 'normal':
      case 'low':
      case 'stable':
      case 'non-demented':
        return 'text-clinical-status-normal font-semibold';
      default:
        return 'text-clinical-textSecondary';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse font-sans">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-clinical" />
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-clinical" />
            <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-clinical" />
          </div>
          <div className="space-y-6">
            <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-clinical" />
            <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-clinical" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6 font-sans antialiased text-clinical-textPrimary"
    >

      {/* Top Header Navigation */}
      <div className="flex items-center justify-between border-b border-clinical-border dark:border-slate-700 pb-4">
        <Link to="/dashboard" className="text-xs font-semibold text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white flex items-center gap-1.5 transition">
          <ArrowLeft className="h-4 w-4 text-clinical-primary" /> Return Dashboard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">

        {/* Left Side: Demographics & Medical Parameters */}
        <div className="space-y-6">

          {/* Patient Card details */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-6 shadow-soft space-y-4">
            <div className="flex items-center gap-2 border-b border-clinical-border dark:border-slate-700 pb-3 text-clinical-primary">
              <User className="h-5 w-5" />
              <h3 className="text-base font-semibold text-clinical-ink dark:text-white">Patient Dossier</h3>
            </div>

            <div className="space-y-2 text-xs font-semibold text-clinical-textSecondary">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Patient Name</span>
                <span className="text-clinical-ink dark:text-white">{name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Patient ID</span>
                <span className="text-clinical-ink dark:text-white font-mono">{id}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Aadhaar / Gov ID</span>
                <span className="text-clinical-ink dark:text-white">{aadhaar}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Age</span>
                <span className="text-clinical-ink dark:text-white">{age} years</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Gender</span>
                <span className="text-clinical-ink dark:text-white">{gender}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Date of Birth</span>
                <span className="text-clinical-ink dark:text-white">{dob}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Blood Group</span>
                <span className="text-clinical-ink dark:text-white">{bloodGroup}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Height / Weight</span>
                <span className="text-clinical-ink dark:text-white">{hVal} cm / {wVal} kg</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Calculated BMI</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-xs">
                  <span className="text-clinical-ink dark:text-white">{bmiValue}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${bmiColorClass}`}>
                    {bmiCategory}
                  </span>
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Assigned Doctor</span>
                <span className="text-clinical-ink dark:text-white">{assignedDoctor}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Phone / Email</span>
                <span className="text-clinical-ink dark:text-white truncate max-w-[180px]">{phone} / {email}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Emergency Contact</span>
                <span className="text-clinical-ink dark:text-white text-right">{emergencyName} ({emergencyRelationship})</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Emergency Contact Phone</span>
                <span className="text-clinical-ink dark:text-white">{emergencyPhone}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Emergency Address</span>
                <span className="text-clinical-ink dark:text-white max-w-[180px] truncate" title={emergencyAddress}>{emergencyAddress}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Medical Record Number (MRN)</span>
                <span className="text-clinical-ink dark:text-white font-mono">{mrn}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary">Hospital Reg ID</span>
                <span className="text-clinical-ink dark:text-white font-mono">{hrn}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-clinical-textSecondary">PACS Registry Timestamp</span>
                <span className="text-clinical-ink dark:text-white font-mono text-[10px]">{registrationTimestamp}</span>
              </div>
            </div>
          </div>

          {/* Medical parameters list */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-6 shadow-soft space-y-4">
            <div className="flex items-center gap-2 border-b border-clinical-border dark:border-slate-700 pb-3 text-clinical-primary">
              <HeartPulse className="h-5 w-5" />
              <h3 className="text-base font-semibold text-clinical-ink dark:text-white">Medical Parameters</h3>
            </div>

            <div className="space-y-4 text-xs font-semibold text-clinical-textSecondary">
              <div>
                <span className="text-[10px] text-clinical-textSecondary font-bold uppercase tracking-wider block">Active Medications</span>
                <p className="text-clinical-textPrimary dark:text-slate-300 mt-1 leading-relaxed">{medications}</p>
              </div>
              <div>
                <span className="text-[10px] text-clinical-textSecondary font-bold uppercase tracking-wider block">Known Allergies</span>
                <p className="text-clinical-textPrimary dark:text-slate-300 mt-1 leading-relaxed">{allergies}</p>
              </div>
              <div>
                <span className="text-[10px] text-clinical-textSecondary font-bold uppercase tracking-wider block">Clinical History Notes</span>
                <p className="text-clinical-textPrimary dark:text-slate-300 mt-1 leading-relaxed">{historyNotes}</p>
              </div>
              <div>
                <span className="text-[10px] text-clinical-textSecondary font-bold uppercase tracking-wider block">Previous Surgeries</span>
                <p className="text-clinical-textPrimary dark:text-slate-300 mt-1 leading-relaxed">{surgeries}</p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-850 space-y-2">
                <span className="text-[10px] text-clinical-textSecondary font-bold uppercase tracking-wider block">Clinical Habits & Comorbidities</span>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Smoking: {smoking}</span>
                  <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">Alcohol: {alcohol}</span>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${diabetes === 'Yes' ? 'bg-clinical-status-warning/15 text-clinical-status-warning border border-clinical-status-warning/30' : 'bg-slate-100 dark:bg-slate-800'}`}>Diabetes: {diabetes}</span>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${hypertension === 'Yes' ? 'bg-clinical-status-warning/15 text-clinical-status-warning border border-clinical-status-warning/30' : 'bg-slate-100 dark:bg-slate-800'}`}>Hypertension: {hypertension}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Longitudinal Charts & Scan History Timeline */}
        <div className="space-y-6">

          {/* Longitudinal Trend Chart */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-6 shadow-soft space-y-4">
            <div>
              <h3 className="text-base font-semibold text-clinical-ink dark:text-white">Longitudinal Health Trends</h3>
              <p className="text-xs text-clinical-textSecondary mt-0.5">Chronological progression of confidence vectors across scans</p>
            </div>

            <div className="h-64 mt-2">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={9} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                    <Tooltip formatter={(value: any, name: any) => [value, name === 'confidence' ? 'Confidence' : 'Risk Index']} />
                    <Line name="Confidence Rate" type="monotone" dataKey="confidence" stroke="#2563EB" strokeWidth={1.5} dot={{ r: 3 }} />
                    <Line name="Risk Indicators" type="monotone" dataKey="riskScore" stroke="#DC2626" strokeWidth={1.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center border border-dashed border-clinical-border dark:border-slate-750 rounded-clinical">
                  <p className="text-xs text-clinical-textSecondary py-20">Timeline parameters empty</p>
                </div>
              )}
            </div>
          </div>

          {/* History Timeline of past scans */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-6 shadow-soft space-y-4">
            <div className="flex items-center gap-2 border-b border-clinical-border dark:border-slate-700 pb-3 text-clinical-primary">
              <Calendar className="h-5 w-5" />
              <h3 className="text-base font-semibold text-clinical-ink dark:text-white">Scan History Timeline</h3>
            </div>

            {scans.length === 0 ? (
              <p className="text-xs text-clinical-textSecondary py-8 text-center">No scan logs compiled for this patient</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                {scans.map((scan) => (
                  <div
                    key={scan.id}
                    className="p-4 border border-clinical-border dark:border-slate-700 hover:border-clinical-primary/45 rounded-clinical bg-white dark:bg-slate-850/40 flex items-center justify-between gap-4 transition-all"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <p className="font-semibold text-xs text-clinical-ink dark:text-slate-205">
                          {new Date(scan.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <span className={`text-[10px] uppercase tracking-wider ${getStatusTextStyle(scan.risk)}`}>
                          {scan.risk} Risk
                        </span>
                      </div>
                      <p className="text-[11px] text-clinical-textSecondary mt-1">
                        Diagnosis: <span className="font-semibold text-clinical-textPrimary dark:text-white">{scan.prediction}</span> | Confidence: <span className="font-semibold text-clinical-textPrimary dark:text-white">{Math.round(scan.confidence)}%</span>
                      </p>
                      <p className="text-[10px] text-clinical-textSecondary font-mono uppercase">Report ID: {scan.reportId}</p>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        to={`/results/${scan.scanId}`}
                        className="px-3 py-1.5 border border-clinical-border dark:border-slate-700 hover:bg-slate-50 rounded-clinical text-[10px] font-bold uppercase text-clinical-textSecondary dark:text-slate-300 transition"
                      >
                        Workbench
                      </Link>
                      {scan.reportId && (
                        <button
                          onClick={() => handleDownloadReport(scan.reportId as string)}
                          disabled={isReportDownloading}
                          className="p-1.5 rounded-clinical border border-clinical-border dark:border-slate-700 text-clinical-primary hover:bg-clinical-primary/10 transition"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </motion.div>
  );
}
