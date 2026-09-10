import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OGDialog, OGDialogContent } from '@librechat/client';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  title: string;
  [key: string]: FAQItem | string;
}

type FAQData = Record<string, FAQSection>;

export default function HelpAndFaqModal({
  open,
  onOpenChange,
  readOnly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  // Fetch the active language's entire FAQ structure dynamically
  const faqData = t('faq', { returnObjects: true }) as FAQData;

  const toggleAccordion = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent
        showCloseButton={readOnly}
        className="flex h-[80vh] w-[80vw] max-w-none flex-col p-6"
      >
        {/* Modal Header */}
        <div className="mb-4 border-b border-gray-200 pb-2 text-xl font-bold dark:border-gray-700">
          {t('com_nav_help_faq')}
        </div>

        {/* Scrollable FAQ Content */}
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {typeof faqData === 'object' &&
            faqData !== null &&
            Object.entries(faqData).map(([sectionKey, section]) => {
              const sectionTyped = section as FAQSection;
              const items = Object.entries(sectionTyped).filter(([key]) => key !== 'title');

              return (
                <div key={sectionKey} className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {sectionTyped.title}
                  </h3>

                  <div className="space-y-2">
                    {items.map(([itemKey, item]) => {
                      const faq = item as FAQItem;
                      const itemUniqueId = `${sectionKey}-${itemKey}`;
                      const isOpen = !!openItems[itemUniqueId];

                      return (
                        <div
                          key={itemKey}
                          className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <button
                            onClick={() => toggleAccordion(itemUniqueId)}
                            className="flex w-full items-center justify-between bg-gray-50 p-3 text-left font-medium transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750"
                          >
                            <span>{faq.question}</span>
                            <span className="ml-2 text-sm text-gray-500">{isOpen ? '▲' : '▼'}</span>
                          </button>

                          {isOpen && (
                            <div className="border-t border-gray-200 bg-white p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                              {faq.answer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}