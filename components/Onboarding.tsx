
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, ShieldCheck, BrainCircuit, BookOpen, ChevronRight, ChevronLeft } from 'lucide-react';
import { Language } from '../types';

const MotionDiv = motion.div as any;

interface OnboardingProps {
  lang: Language;
  onComplete: () => void;
}

const onboardingData = {
  ar: [
    {
      title: "مرحباً بك في محرابك",
      description: "مساحتك الخاصة للغوص في أعماق المعرفة بعيداً عن ضجيج العالم الرقمي.",
      icon: <BookOpen className="text-[#ff0000]" size={48} />,
      color: "from-[#ff0000]/20 to-transparent"
    },
    {
      title: "بناء عادة متينة",
      description: "نظامنا مصمم لمرافقتك في رحلة الـ 40 يوماً الذهبية لتحويل القراءة من فعل عابر إلى روتين حياة.",
      icon: <BrainCircuit className="text-emerald-500" size={48} />,
      color: "from-emerald-500/20 to-transparent"
    },
    {
      title: "جلسات الإنقاذ",
      description: "في أيامك المزدحمة، دقيقتان فقط كافية لإنقاذ سلسلتك (Streak) والحفاظ على الزخم.",
      icon: <Zap className="text-orange-500" size={48} />,
      color: "from-orange-500/20 to-transparent"
    },
    {
      title: "دروع الحماية",
      description: "التزم بـ 15 دقيقة يومياً لتحصل على دروع تحميك تلقائياً في الأيام التي قد تضطر فيها للتوقف.",
      icon: <ShieldCheck className="text-blue-500" size={48} />,
      color: "from-blue-500/20 to-transparent"
    },
    {
      title: "رابطة القراءة",
      description: "بيئة سينمائية هادئة تعيد صياغة علاقتك بالكتاب، لتصبح القراءة ملاذك المفضل.",
      icon: <Sparkles className="text-purple-500" size={48} />,
      color: "from-purple-500/20 to-transparent"
    }
  ],
  en: [
    {
      title: "Welcome to Your Sanctuary",
      description: "Your private space to dive into deep knowledge away from digital noise.",
      icon: <BookOpen className="text-[#ff0000]" size={48} />,
      color: "from-[#ff0000]/20 to-transparent"
    },
    {
      title: "Build Solid Habits",
      description: "Our system is designed to guide you through the golden 40-day journey to make reading a lifestyle.",
      icon: <BrainCircuit className="text-emerald-500" size={48} />,
      color: "from-emerald-500/20 to-transparent"
    },
    {
      title: "Rescue Sessions",
      description: "On busy days, just 2 minutes are enough to save your streak and maintain momentum.",
      icon: <Zap className="text-orange-500" size={48} />,
      color: "from-orange-500/20 to-transparent"
    },
    {
      title: "Protective Shields",
      description: "Commit to 15 minutes daily to earn shields that automatically protect you on days you can't read.",
      icon: <ShieldCheck className="text-blue-500" size={48} />,
      color: "from-blue-500/20 to-transparent"
    },
    {
      title: "The Reading Bond",
      description: "A cinematic, quiet environment that reshapes your relationship with books, making reading your favorite retreat.",
      icon: <Sparkles className="text-purple-500" size={48} />,
      color: "from-purple-500/20 to-transparent"
    }
  ]
};

export const Onboarding: React.FC<OnboardingProps> = ({ lang, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const steps = onboardingData[lang];
  const isLastStep = currentIndex === steps.length - 1;
  const isRTL = lang === 'ar';

  const next = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  return (
    <MotionDiv 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-[#000a00] flex items-center justify-center p-6"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute inset-0 bg-gradient-to-b ${steps[currentIndex].color} opacity-30 transition-colors duration-1000`} />
      </div>

      <div className="relative w-full max-w-lg flex flex-col items-center text-center">
        <AnimatePresence mode="wait">
          <MotionDiv
            key={currentIndex}
            initial={{ y: 20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <div className="mb-12 p-8 rounded-[3rem] bg-white/[0.03] border border-white/10 shadow-2xl">
              {steps[currentIndex].icon}
            </div>
            
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-6 italic">
              {steps[currentIndex].title}
            </h2>
            
            <p className="text-sm md:text-base text-white/60 font-bold leading-relaxed max-w-sm mb-12">
              {steps[currentIndex].description}
            </p>
          </MotionDiv>
        </AnimatePresence>

        <div className="flex items-center gap-4 mb-12">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-8 bg-[#ff0000]' : 'w-2 bg-white/10'}`} 
            />
          ))}
        </div>

        <div className="flex items-center gap-6 w-full">
          {currentIndex > 0 && (
            <button 
              onClick={prev}
              className="p-4 rounded-full bg-white/5 text-white/40 hover:text-white transition-all border border-white/10"
            >
              {isRTL ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
            </button>
          )}
          
          <button 
            onClick={next}
            className="flex-1 bg-white text-black py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-[#ff0000] hover:text-white transition-all active:scale-95"
          >
            {isLastStep ? (lang === 'ar' ? 'ابدأ الرحلة' : 'Begin Journey') : (lang === 'ar' ? 'التالي' : 'Next')}
          </button>
        </div>
      </div>
    </MotionDiv>
  );
};
