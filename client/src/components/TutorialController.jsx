import React, { useState, useEffect } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import { useSelector } from 'react-redux';
import { FaLeaf } from 'react-icons/fa';

const TutorialController = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const [run, setRun] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const isFirstTime = !localStorage.getItem('krishisetu_tour_done');
    if (isFirstTime && userInfo) {
      setShowHint(true);
    }

    const startTour = () => {
      let checkCount = 0;
      const checkExist = setInterval(() => {
        // Check for any of the main navigation targets
        const hasTarget = document.querySelector('.market-nav') || 
                          document.querySelector('.dashboard-link') ||
                          document.querySelector('.tutorial-btn-nav');
        
        if (hasTarget) {
          clearInterval(checkExist);
          setRun(true);
          setShowHint(false);
        }
        
        checkCount++;
        if (checkCount > 10) {
          clearInterval(checkExist);
          console.warn("Tutorial targets not found on this page.");
        }
      }, 300);
    };
    
    window.addEventListener('start-tutorial', startTour);
    return () => window.removeEventListener('start-tutorial', startTour);
  }, [userInfo]);

  // Define all possible steps
  const allSteps = userInfo?.role?.toLowerCase() === 'farmer' ? [
    {
      target: '.dashboard-link',
      content: t('tutorial.steps.farmerDashboard'),
      placement: 'bottom',
    },
    {
      target: '.add-product-btn',
      content: t('tutorial.steps.map'),
    },
    {
      target: '.profile-link',
      content: t('tutorial.steps.settings'),
    }
  ] : [
    {
      target: '.market-nav',
      content: t('tutorial.steps.market'),
      placement: 'bottom',
    },
    {
      target: '.subscription-toggle', // Yeh sirf Checkout page par milega
      content: t('tutorial.steps.subscription'),
    },
    {
      target: '.language-selector',
      content: t('tutorial.steps.lang'),
    }
  ];

  // --- FIX: Filter steps to show only mounted targets ---
  // Isse "Step 1 of 3" ki jagah sahi count (e.g. "Step 1 of 2") dikhega
  const filteredSteps = allSteps.filter(step => document.querySelector(step.target));

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false);
      localStorage.setItem('krishisetu_tour_done', 'true');
    }
  };

  return (
    <>
      {showHint && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm text-center border-t-8 border-green-600 animate-in fade-in zoom-in duration-300">
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FaLeaf className="text-green-600 text-3xl" />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-3">{t('tutorial.hintTitle')}</h3>
            <p className="text-gray-600 mb-8 text-sm leading-relaxed font-medium">{t('tutorial.hintText')}</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.dispatchEvent(new Event('start-tutorial'))}
                className="bg-green-600 text-white py-4 rounded-2xl font-bold hover:bg-green-700 shadow-lg active:scale-95 transition-all"
              >
                {t('tutorial.btnShow')}
              </button>
              <button 
                onClick={() => { setShowHint(false); localStorage.setItem('krishisetu_tour_done', 'true'); }}
                className="text-gray-400 text-xs font-black uppercase tracking-widest hover:text-gray-600"
              >
                {t('tutorial.btnLater')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Joyride
        steps={filteredSteps} // Using filtered steps here
        run={run}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        scrollToFirstStep={true}
        disableScrolling={false}
        callback={handleJoyrideCallback}
        locale={{
          back: t('tutorial.back'),
          close: t('tutorial.close'),
          last: t('tutorial.last'),
          next: t('tutorial.next'),
          skip: t('tutorial.skip'),
        }}
        styles={{
          options: {
            primaryColor: "#166534",
            backgroundColor: "#ffffff",
            overlayColor: "rgba(0, 0, 0, 0.8)",
            zIndex: 10000,
          },
          tooltip: { borderRadius: '20px', padding: '20px' },
          buttonNext: { backgroundColor: "#166534", borderRadius: '12px', padding: '12px 28px', fontWeight: '900' },
          buttonBack: { color: "#166534", fontWeight: '900' }
        }}
      />
    </>
  );
};

export default TutorialController;