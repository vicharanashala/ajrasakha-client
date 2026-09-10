import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import {
  BookOpen,
  ChevronDown,
  HelpCircle,
  Info,
  MessageCircleQuestion,
  Search,
  Sprout,
  ThumbsUp,
  UserCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  title: string;
  [key: string]: FAQItem | string;
}

type FAQData = Record<string, FAQSection>;

/** A FAQ section flattened into an ordered item list for rendering, search and navigation. */
interface NormalizedFAQSection {
  key: string;
  title: string;
  Icon: LucideIcon;
  items: Array<{ id: string; question: string; answer: string }>;
}

/** Icon per FAQ section key from the translation files, so the nav stays scannable. */
const SECTION_ICONS: Record<string, LucideIcon> = {
  about_ajrasakha: Info,
  asking_questions: MessageCircleQuestion,
  asking_about_crops_and_locations: Sprout,
  answers_and_expert_support: UserCheck,
  feedback: ThumbsUp,
  sources_and_privacy: BookOpen,
};

/** Cap on the entrance stagger so a long FAQ list never feels slow to appear. */
const MAX_STAGGERED_SECTIONS = 6;

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
  const localize = useLocalize();
  const [itemOpenStates, setItemOpenStates] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Fetch the active language's entire FAQ structure dynamically
  const faqData = t('faq', { returnObjects: true }) as FAQData;

  // Converts the nested translation FAQ object into an ordered list of sections and items.
  const sections = useMemo<NormalizedFAQSection[]>(() => {
    if (typeof faqData !== 'object' || faqData === null) {
      return [];
    }

    return Object.entries(faqData).map(([sectionKey, section]) => ({
      key: sectionKey,
      title: section.title,
      Icon: SECTION_ICONS[sectionKey] ?? HelpCircle,
      items: Object.entries(section)
        .filter(([itemKey]) => itemKey !== 'title')
        .map(([itemKey, item]) => {
          const faq = item as FAQItem;
          return { id: `${sectionKey}-${itemKey}`, question: faq.question, answer: faq.answer };
        }),
    }));
  }, [faqData]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Keeps only the items matching the search query, dropping sections left without matches.
  const filteredSections = useMemo(() => {
    if (!normalizedQuery) {
      return sections;
    }

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(normalizedQuery) ||
            item.answer.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, normalizedQuery]);

  // Expanded ids for one section: searching reveals matches by default, explicit toggles win.
  const getSectionValue = (section: NormalizedFAQSection) =>
    section.items
      .filter((item) => itemOpenStates[item.id] ?? normalizedQuery !== '')
      .map((item) => item.id);

  // Records the expanded state of every item in one section without touching other sections.
  const handleSectionValueChange = (section: NormalizedFAQSection, value: string[]) => {
    setItemOpenStates((prev) => {
      const next = { ...prev };
      section.items.forEach((item) => {
        next[item.id] = value.includes(item.id);
      });
      return next;
    });
  };

  // Scrolls the FAQ list to the selected section and highlights it in the section nav.
  const scrollToSection = (sectionKey: string) => {
    const container = scrollContainerRef.current;
    const target = sectionRefs.current[sectionKey];
    if (!container || !target) {
      return;
    }

    container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
    setActiveSectionKey(sectionKey);
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent
        showCloseButton={readOnly}
        className="flex h-[90vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:h-[85vh] lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
      >
        <OGDialogHeader className="shrink-0 space-y-3 border-b border-border-light px-4 py-4 text-left sm:px-6">
          {/* The app mark next to the title keeps the help dialog on-brand. */}
          <div className="flex items-center gap-3 pr-10">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-500/10 duration-300 animate-in fade-in-0 zoom-in-75 dark:bg-green-400/10 sm:size-10">
              <img
                src="/assets/annam-logo.png"
                alt=""
                aria-hidden="true"
                className="size-5 object-contain sm:size-6"
              />
            </span>
            <OGDialogTitle className="text-base font-semibold text-text-primary duration-300 animate-in fade-in-0 slide-in-from-left-2 sm:text-lg">
              {localize('com_nav_help_faq')}
            </OGDialogTitle>
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={localize('com_ui_search')}
              aria-label={localize('com_ui_search')}
              className="h-10 w-full rounded-xl border border-border-light bg-surface-secondary pl-9 pr-9 text-sm text-text-primary transition-colors placeholder:text-text-secondary focus:border-border-heavy focus:outline-none focus:ring-2 focus:ring-ring-primary"
            />
            {searchQuery !== '' && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={localize('com_ui_clear')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-secondary transition-colors duration-150 animate-in fade-in-0 zoom-in-90 hover:bg-surface-hover hover:text-text-primary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </OGDialogHeader>

        {/* Section navigation as a horizontal chip row on small screens */}
        {filteredSections.length > 0 && (
          <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border-light px-4 py-2 md:hidden">
            {filteredSections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => scrollToSection(section.key)}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors duration-200 animate-in fade-in-0',
                  activeSectionKey === section.key
                    ? 'border-transparent bg-surface-active font-medium text-text-primary'
                    : 'border-border-light text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                )}
              >
                <section.Icon
                  className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400"
                  aria-hidden="true"
                />
                {section.title}
              </button>
            ))}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {/* Section navigation as a sticky sidebar from tablet width up */}
          {filteredSections.length > 0 && (
            <nav
              aria-label={localize('com_nav_help_faq')}
              className="hidden w-56 shrink-0 overflow-y-auto border-r border-border-light px-2 py-4 duration-300 animate-in fade-in-0 slide-in-from-left-2 md:block lg:w-64"
            >
              <ul className="space-y-1">
                {filteredSections.map((section) => (
                  <li key={section.key}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(section.key)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200 animate-in fade-in-0',
                        activeSectionKey === section.key
                          ? 'bg-surface-active font-medium text-text-primary'
                          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                      )}
                    >
                      <section.Icon
                        className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">{section.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div
            ref={scrollContainerRef}
            tabIndex={0}
            className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 focus:outline-none sm:px-6"
          >
            {filteredSections.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center duration-300 animate-in fade-in-0 zoom-in-95">
                <Search className="h-6 w-6 text-text-secondary" aria-hidden="true" />
                <p className="text-sm text-text-secondary">{localize('com_ui_nothing_found')}</p>
              </div>
            ) : (
              filteredSections.map((section, sectionIndex) => (
                <section
                  key={section.key}
                  ref={(element) => {
                    sectionRefs.current[section.key] = element;
                  }}
                  // Sections fade up in sequence as the dialog opens and as search results change.
                  style={{
                    animationDelay: `${Math.min(sectionIndex, MAX_STAGGERED_SECTIONS) * 45}ms`,
                    animationFillMode: 'backwards',
                  }}
                  className="pb-6 duration-300 animate-in fade-in-0 slide-in-from-bottom-2 last:pb-0"
                >
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    <section.Icon
                      className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400"
                      aria-hidden="true"
                    />
                    {section.title}
                  </h3>

                  <AccordionPrimitive.Root
                    type="multiple"
                    value={getSectionValue(section)}
                    onValueChange={(value) => handleSectionValueChange(section, value)}
                    className="space-y-2"
                  >
                    {section.items.map((item) => (
                      <AccordionPrimitive.Item
                        key={item.id}
                        value={item.id}
                        className="overflow-hidden rounded-xl border border-border-light bg-surface-primary-alt transition-colors hover:border-border-medium"
                      >
                        <AccordionPrimitive.Header className="flex">
                          <AccordionPrimitive.Trigger className="group flex w-full items-start justify-between gap-3 px-3 py-3 text-left text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-primary sm:px-4">
                            <span className="flex min-w-0 items-start gap-2.5">
                              <HelpCircle
                                className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary"
                                aria-hidden="true"
                              />
                              <span>{item.question}</span>
                            </span>
                            <ChevronDown
                              className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary transition-transform duration-200 group-data-[state=open]:rotate-180"
                              aria-hidden="true"
                            />
                          </AccordionPrimitive.Trigger>
                        </AccordionPrimitive.Header>

                        {/* Radix drives the height animation both ways, so collapsing is animated too. */}
                        <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                          <div className="border-t border-border-light px-3 py-3 pl-[2.375rem] text-sm leading-relaxed text-text-secondary sm:px-4 sm:pl-[2.875rem]">
                            {item.answer}
                          </div>
                        </AccordionPrimitive.Content>
                      </AccordionPrimitive.Item>
                    ))}
                  </AccordionPrimitive.Root>
                </section>
              ))
            )}
          </div>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
