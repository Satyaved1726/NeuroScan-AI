import MaterialIcon from '../components/MaterialIcon';

const ArrowRight = ({ className }: { className?: string }) => <MaterialIcon name="arrow_forward" className={className} />;
const FileText = ({ className }: { className?: string }) => <MaterialIcon name="description" className={className} />;
const UserPlus = ({ className }: { className?: string }) => <MaterialIcon name="person_add" className={className} />;
const Microscope = ({ className }: { className?: string }) => <MaterialIcon name="biotech" className={className} />;
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function LandingPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen text-clinical-textPrimary bg-white dark:bg-[#0F172A] -mt-16 font-sans antialiased"
    >

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-28 pb-20 px-4 lg:px-8 border-b border-clinical-border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/20">
        <div className="max-w-7xl mx-auto grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center relative z-10">

          {/* Left Text Details */}
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-clinical border border-clinical-primary/20 bg-blue-50 dark:bg-slate-850 px-3.5 py-1 text-xs font-semibold text-clinical-primary tracking-wider uppercase">
              Healthcare-Grade AI Diagnostics
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl leading-[1.15] text-clinical-ink dark:text-white">
                Next-Gen Dementia Detection <span className="text-clinical-primary">From MRI Scans</span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-clinical-textSecondary">
                Detect cognitive decline earlier using deep learning neural networks and explainable Grad-CAM AI heatmaps. Engineered side-by-side with clinicians for diagnostic precision and hospital EHR integration.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link to="/analysis" className="inline-flex items-center gap-2 rounded-clinical bg-clinical-primary px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition-all hover:bg-clinical-primaryDark btn-transition">
                Start Workspace Analysis <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#features" className="inline-flex items-center gap-2 rounded-clinical border border-clinical-border dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3.5 text-sm font-semibold text-clinical-textPrimary shadow-soft transition-all hover:bg-slate-50 dark:hover:bg-slate-700 btn-transition">
                Explore Technology
              </a>
            </div>

            {/* Quick check grid */}
            <div className="grid gap-3 sm:grid-cols-3 pt-6 border-t border-clinical-border dark:border-slate-700">
              {[
                { label: 'DICOM/PNG Upload', desc: 'Secure AES transmission' },
                { label: 'Explainable AI Overlay', desc: 'Grad-CAM heatmaps' },
                { label: 'Clinical-Ready Reports', desc: 'PDF sign-off exports' }
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 p-3.5 rounded-clinical bg-white dark:bg-slate-800 border border-clinical-border dark:border-slate-700 shadow-soft">
                  <div className="text-xs font-semibold text-clinical-textPrimary dark:text-slate-100 flex items-center gap-1">
                    <span className="text-clinical-primary font-bold">✓</span> {item.label}
                  </div>
                  <span className="text-[11px] text-clinical-textSecondary font-semibold mt-1 leading-normal">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Floating Glass Mockup Card */}
          <div className="rounded-clinical border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] p-6 shadow-soft relative overflow-hidden">
            <div className="mb-6">
              <p className="text-[10px] font-semibold text-clinical-primary uppercase tracking-widest">[INFERENCE PARAMETERS]</p>
              <p className="text-xl font-semibold text-clinical-ink dark:text-white mt-1">Diagnostic Classification</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* MRI scan visualization box */}
              <div className="rounded-clinical bg-slate-50 dark:bg-slate-800/40 border border-clinical-border dark:border-slate-700 p-4 flex flex-col justify-between">
                <div className="text-xs font-semibold text-clinical-primary">
                  CNN Backbone
                </div>
                <div className="my-4 h-32 rounded-clinical border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] flex items-center justify-center relative overflow-hidden">
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-clinical-primary/40 animate-spin" />
                  <span className="absolute text-[10px] font-semibold uppercase tracking-wider text-clinical-textSecondary">GRID CHECK</span>
                </div>
                <div className="text-[10px] text-clinical-textSecondary font-semibold text-center uppercase tracking-wide">Voxel matrix coordinates</div>
              </div>

              {/* Stat Cards Stack */}
              <div className="flex flex-col justify-between gap-3">
                <div className="rounded-clinical bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 p-4 shadow-soft">
                  <p className="text-[10px] text-clinical-textSecondary font-semibold uppercase tracking-wide">Accuracy Rate</p>
                  <p className="mt-1 text-2xl font-semibold text-clinical-primary">94.6% ACC</p>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-2.5 overflow-hidden">
                    <div className="h-full bg-clinical-primary w-[94.6%]" />
                  </div>
                </div>
                <div className="rounded-clinical bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 p-4 shadow-soft">
                  <p className="text-[10px] text-clinical-textSecondary font-semibold uppercase tracking-wide">Gradient Overlays</p>
                  <p className="mt-1 text-xl font-semibold text-clinical-primary">GRAD-CAM</p>
                  <p className="text-[10px] text-clinical-textSecondary font-semibold mt-1">Explainable visual focus</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Trust Strip */}
      <section className="bg-white dark:bg-[#1E293B] border-y border-clinical-border dark:border-slate-700 py-8 px-4 shadow-soft">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-around items-center gap-8 text-center">
          <div>
            <p className="text-3xl font-semibold text-clinical-primary">94.6%</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider mt-1 text-clinical-textSecondary">CNN Model Accuracy</p>
          </div>
          <div className="h-8 w-px bg-clinical-border dark:bg-slate-700 hidden md:block" />
          <div>
            <p className="text-3xl font-semibold text-clinical-primary">100%</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider mt-1 text-clinical-textSecondary">HIPAA Compliant Tunneling</p>
          </div>
          <div className="h-8 w-px bg-clinical-border dark:bg-slate-700 hidden md:block" />
          <div>
            <p className="text-3xl font-semibold text-clinical-primary">&lt; 8.2s</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider mt-1 text-clinical-textSecondary">Inference Pipeline Latency</p>
          </div>
          <div className="h-8 w-px bg-clinical-border dark:bg-slate-700 hidden md:block" />
          <div>
            <p className="text-3xl font-semibold text-clinical-primary">21</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider mt-1 text-clinical-textSecondary">Multilingual Languages</p>
          </div>
        </div>
      </section>

      {/* How it Works Horizontal Section */}
      <section className="max-w-7xl mx-auto py-20 px-4 lg:px-8 space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-clinical-primary">Diagnostic Flow</p>
          <h2 className="text-3xl font-semibold text-clinical-ink dark:text-white leading-tight sm:text-4xl">4-Step Diagnostic Pipeline</h2>
          <p className="text-sm text-clinical-textSecondary font-semibold">Accelerated radiological screening from uploads to PDF signatures</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4 relative">
          {[
            { step: '01', title: 'Upload Scan', desc: 'Securely drop DICOM or PNG brain scans into the workstation.', icon: UserPlus },
            { step: '02', title: 'AI Preprocessing', desc: 'Coordinates matrix voxel planes and performs normalisation.', icon: Microscope },
            { step: '03', title: 'CNN Classification', desc: 'Computes diagnostic probabilities and maps attention gradients.', icon: Microscope },
            { step: '04', title: 'Sign-Off Report', desc: 'Verify recommendations and export signed clinical document PDFs.', icon: FileText }
          ].map((item) => (
            <div key={item.step} className="p-6 rounded-clinical bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 shadow-soft hover:border-clinical-primary transition-all relative group">
              <span className="absolute right-4 top-4 text-3xl font-semibold text-clinical-border dark:text-slate-700 group-hover:text-clinical-primary/25 transition-colors">
                {item.step}
              </span>
              <div className="h-10 w-10 rounded-clinical bg-clinical-primary/10 border border-clinical-primary/20 text-clinical-primary flex items-center justify-center mb-4">
                <item.icon className="h-5 w-5 text-clinical-primary" />
              </div>
              <h3 className="text-base font-semibold text-clinical-ink dark:text-white">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-clinical-textSecondary font-semibold">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="bg-white dark:bg-[#1E293B] border-t border-clinical-border dark:border-slate-700 py-20 px-4 lg:px-8 shadow-soft">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-clinical-primary">Platform Capabilities</p>
            <h2 className="text-3xl font-semibold text-clinical-ink dark:text-white leading-tight sm:text-4xl">Engineered for Clinicians & Researchers</h2>
            <p className="text-sm text-clinical-textSecondary font-semibold">Every capability maps directly to healthcare-grade accuracy benchmarks.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[
              { title: 'Explainable AI heatmaps', description: 'Interactive Grad-CAM layers overlay directly onto scan nodes to highlight critical attention sectors.' },
              { title: 'Voxel volume telemetry', description: 'Calculates bilateral hippocampus lobe volumes in real-time to track spatial shrinkage indices.' },
              { title: 'Clinician sign-off workflow', description: 'Authorized medical signature releases unlock compliant diagnostic report document downloads.' },
              { title: 'HIPAA log vaulting', description: 'Patient records, screening notes, and predictions undergo secure transit under regulatory isolation parameters.' },
              { title: 'Longitudinal health trends', description: 'Maintains timeline analytics across multiple screenings to monitor stages from non-demented to mild decline.' },
              { title: 'Structured reports database', description: 'Securely indexes all completed inference sequences for immediate clinic access.' }
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-slate-50 dark:bg-slate-800/40 border border-clinical-border dark:border-slate-700 hover:border-clinical-primary/45 rounded-clinical p-6 shadow-soft transition-all flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-base font-semibold text-clinical-ink dark:text-white">{feature.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-clinical-textSecondary font-semibold">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target User Roles section (three-column, simple white backgrounds, soft shadows, 10px borders) */}
      <section className="max-w-7xl mx-auto py-20 px-4 lg:px-8 space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-clinical-primary">Clinical Context</p>
          <h2 className="text-3xl font-semibold text-clinical-ink dark:text-white leading-tight sm:text-4xl">Who Benefits From NeuroScan?</h2>
          <p className="text-sm text-clinical-textSecondary font-semibold">Optimized, high-density views tailored for healthcare environments</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            { title: 'For Radiologists', desc: 'Accelerates diagnostic screening times with automatic voxel pre-registration, side-by-side DICOM slides, and explainable Grad-CAM regions.' },
            { title: 'For Neurologists', desc: 'Provides clinical longitudinal analytics to trace dementia stage indicators and patient treatment profiles over multiple scan history timelines.' },
            { title: 'For Hospital Administrators', desc: 'Enforces professional RBAC credentialing permissions, reviews real-time security audit trails, and tracks active model latency performance.' }
          ].map((card) => (
            <div key={card.title} className="p-6 rounded-clinical bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 shadow-soft">
              <h3 className="text-base font-semibold text-clinical-ink dark:text-white">{card.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-clinical-textSecondary font-semibold mt-1">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer Disclaimer */}
      <footer className="bg-slate-50 dark:bg-slate-900 border-t border-clinical-border dark:border-slate-700 py-12 px-4 text-clinical-textSecondary">
        <div className="max-w-7xl mx-auto space-y-6 text-center">
          <p className="max-w-2xl mx-auto text-[11px] leading-relaxed text-clinical-textSecondary font-semibold uppercase tracking-wider">
            Disclaimer: This application is a clinical decision support tool. It does not replace the professional diagnostic evaluations or sign-offs of a certified neurologist or physician.
          </p>
          <div className="h-px bg-clinical-border dark:bg-slate-700" />
          <p className="text-[10px] text-clinical-textSecondary font-semibold tracking-wider uppercase">
            &copy; {new Date().getFullYear()} NeuroScan AI Inc. Professional Hospital Edition.
          </p>
        </div>
      </footer>
    </motion.div>
  );
}
