import { useState, useEffect, useCallback, useMemo } from 'react';
import Cookies from 'js-cookie';
import { useForm, Controller } from 'react-hook-form';
import { useRecoilState } from 'recoil';
import {
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  Label,
  Input,
} from '@librechat/client';
import type { IFarmerProfile } from 'librechat-data-provider';
import { useSaveFarmerProfileMutation } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import useGeolocation from '~/hooks/useGeolocation';
import store from '~/store';
import { LangSelector } from '~/components/Nav/SettingsTabs/General/General';
import { STATES, DISTRICTS } from '~/utils/metaData';
import SearchableSelect from './SearchableSelect';

type FarmerLocationForm = Partial<IFarmerProfile> & {
  landhold?: string;
  age?: string;
  yearsOfExperience?: string;
  numberOfSmartphones?: string;
  languagePreference?: string;
  customDistrict?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

const FarmerLocationModal = ({
  open,
  onOpenChange,
  onComplete,
  missingFields = [],
}: {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onComplete: () => void;
  missingFields?: string[];
}) => {
  const { user } = useAuthContext();
  const localize = useLocalize();
  const [langcode, setLangcode] = useRecoilState(store.lang);
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    unregister,
    clearErrors,
    formState: { errors },
  } = useForm<FarmerLocationForm>({
    mode: 'onChange',
    shouldUnregister: true,
  });

  const resolveLanguageCode = useCallback((value: string) => {
    if (value !== 'auto') {
      return value;
    }
    return (
      (typeof navigator !== 'undefined' ? navigator.language || navigator.languages?.[0] : null) ??
      'en-US'
    );
  }, []);

  const handleLanguageChange = useCallback(
    (value: string) => {
      const userLang = resolveLanguageCode(value);
      requestAnimationFrame(() => {
        document.documentElement.lang = userLang;
      });
      setLangcode(userLang);
      Cookies.set('lang', userLang, { expires: 365 });
      localStorage.setItem('lang_selected', 'true');
      setValue('languagePreference', userLang, { shouldValidate: true });
    },
    [resolveLanguageCode, setLangcode, setValue],
  );

  useEffect(() => {
    const allFields: (keyof FarmerLocationForm)[] = [
      'farmerName',
      'age',
      'gender',
      'villageName',
      'blockName',
      'district',
      'state',
      'phoneNo',
      'languagePreference',
      'yearsOfExperience',
      'highestEducatedPerson',
      'numberOfSmartphones',
      'primaryCrop',
      'secondaryCrop',
      'cropsCultivated',
      'landhold',
      'awarenessOfKCC',
      'usesAgriApps',
      'customDistrict',
    ];
    const fieldsToUnregister = allFields.filter((f) => !missingFields.includes(f as string));
    fieldsToUnregister.forEach((f) => {
      unregister(f);
      clearErrors(f);
    });
  }, [missingFields, unregister, clearErrors]);

  useEffect(() => {
    if (missingFields.includes('languagePreference') && !watch('languagePreference')) {
      setValue('languagePreference', langcode, { shouldValidate: true });
    }
  }, [langcode, missingFields, setValue, watch]);

  const watchedState = watch('state');
  const selectedState = watchedState || user?.farmerProfile?.state;
  const selectedDistrict = watch('district');

  const matchedStateKey = selectedState
    ? Object.keys(DISTRICTS).find((k) => k.toLowerCase() === selectedState.toLowerCase())
    : undefined;

  const districtOptions = matchedStateKey
    ? [...(DISTRICTS[matchedStateKey] ?? []), 'Other']
    : ['Other'];

  const handleStateChange = (val: string) => {
    setValue('state', val, { shouldValidate: true });
    setValue('district', '', { shouldValidate: false });
    setValue('customDistrict', '', { shouldValidate: false });
  };

  const handleDistrictChange = (val: string) => {
    setValue('district', val, { shouldValidate: true });
    if (val !== 'Other') {
      setValue('customDistrict', '', { shouldValidate: false });
    }
  };

  const { isLocating, locationError, getLocation } = useGeolocation({
    onSuccess: (latitude, longitude) => {
      setValue('location.latitude', latitude, { shouldValidate: true });
      setValue('location.longitude', longitude, { shouldValidate: true });
    },
  });

  const saveMutation = useSaveFarmerProfileMutation({
    onSuccess: () => {
      setSubmitError('');
      onComplete();
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      setSubmitError(localize('com_farmer_error_save_profile'));
    },
  });

  const onFormError = (formErrors: any) => {
    console.error('Form validation failed:', formErrors);
  };

  const onSubmit = (data: FarmerLocationForm) => {
    const profilePayload: Partial<IFarmerProfile> & Record<string, any> = {};
    missingFields.forEach((field) => {
      if (field === 'location' && data.location?.latitude && data.location?.longitude) {
        profilePayload.location = {
          latitude: Number(data.location.latitude),
          longitude: Number(data.location.longitude),
        };
      } else if (['landhold', 'age', 'yearsOfExperience', 'numberOfSmartphones'].includes(field)) {
        if (data[field as keyof FarmerLocationForm]) {
          profilePayload[field] = Number(data[field as keyof FarmerLocationForm]);
        }
      } else if (['awarenessOfKCC', 'usesAgriApps'].includes(field)) {
        if (data[field as keyof FarmerLocationForm]) {
          profilePayload[field] = data[field as keyof FarmerLocationForm] === 'yes';
        }
      } else if (field === 'district') {
        profilePayload.district = data.district === 'Other' ? data.customDistrict : data.district;
      } else if (field === 'cropsCultivated' && data.cropsCultivated) {
        profilePayload.cropsCultivated = (data.cropsCultivated as any)
          .split(',')
          .map((c: string) => c.trim())
          .filter(Boolean);
      } else {
        if (data[field as keyof FarmerLocationForm]) {
          profilePayload[field] = data[field as keyof FarmerLocationForm];
        }
      }
    });
    saveMutation.mutate(profilePayload as IFarmerProfile);
  };

  const fieldClass = 'mb-4';
  const inputClass =
    'mt-1 block w-full rounded-md border border-border-heavy bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-green-500';

  const isLocationMissing = missingFields.includes('location');
  const otherMissingFields = missingFields.filter((f) => f !== 'location');

  const orderedMissingFields = useMemo(() => {
    const sorted = [...otherMissingFields];
    sorted.sort((a, b) => {
      if (a === 'languagePreference') return -1;
      if (b === 'languagePreference') return 1;
      return 0;
    });
    return sorted;
  }, [otherMissingFields]);

  const fieldConfig: Record<
    string,
    { label: string; type: string; placeholder?: string; options?: string[] }
  > = {
    farmerName: {
      label: localize('com_farmer_label_farmer_name'),
      type: 'text',
      placeholder: localize('com_farmer_placeholder_full_name_example'),
    },
    age: {
      label: localize('com_farmer_label_age'),
      type: 'number',
      placeholder: localize('com_farmer_placeholder_age_example'),
    },
    gender: {
      label: localize('com_farmer_label_gender'),
      type: 'searchable-select',
      options: [
        localize('com_farmer_option_male'),
        localize('com_farmer_option_female'),
        localize('com_farmer_option_other'),
      ],
    },
    state: {
      label: localize('com_farmer_label_state'),
      type: 'searchable-select',
      options: STATES,
    },
    district: {
      label: localize('com_farmer_label_district'),
      type: 'searchable-select',
      options: districtOptions,
    },
    villageName: {
      label: localize('com_farmer_label_village_name'),
      type: 'text',
      placeholder: localize('com_farmer_placeholder_village_example'),
    },
    blockName: {
      label: localize('com_farmer_label_block_name'),
      type: 'text',
      placeholder: localize('com_farmer_placeholder_block_example'),
    },
    phoneNo: {
      label: localize('com_farmer_label_phone_number'),
      type: 'text',
      placeholder: localize('com_farmer_placeholder_phone_number_example'),
    },
    languagePreference: { label: localize('com_nav_language'), type: 'language-select' },
    yearsOfExperience: {
      label: localize('com_farmer_label_years_experience_short'),
      type: 'number',
      placeholder: localize('com_farmer_placeholder_years_example'),
    },
    highestEducatedPerson: {
      label: localize('com_farmer_label_highest_educated'),
      type: 'searchable-select',
      options: [
        localize('com_farmer_option_under_graduate'),
        localize('com_farmer_option_graduate'),
        localize('com_farmer_option_post_graduate'),
      ],
    },
    numberOfSmartphones: {
      label: localize('com_farmer_label_smartphone_count_short'),
      type: 'number',
      placeholder: localize('com_farmer_placeholder_smartphone_count_example'),
    },
    primaryCrop: {
      label: localize('com_farmer_label_primary_crop'),
      type: 'text',
      placeholder: localize('com_farmer_placeholder_primary_crop_example'),
    },
    secondaryCrop: {
      label: localize('com_farmer_label_secondary_crop'),
      type: 'text',
      placeholder: localize('com_farmer_placeholder_secondary_crop_example'),
    },
    cropsCultivated: {
      label: localize('com_farmer_label_crops_cultivated'),
      type: 'text',
      placeholder: localize('com_farmer_placeholder_crops_example'),
    },
    landhold: {
      label: localize('com_farmer_label_landholding_short'),
      type: 'number',
      placeholder: localize('com_farmer_placeholder_landholding_example'),
    },
    awarenessOfKCC: {
      label: localize('com_farmer_label_awareness_kcc'),
      type: 'radio',
    },
    usesAgriApps: {
      label: localize('com_farmer_label_usage_agri_apps'),
      type: 'radio',
    },
  };

  const getValidationRules = (field: string, label: string) => {
    if (field === 'phoneNo') {
      return {
        required: localize('com_farmer_validation_phone_required'),
        pattern: {
          value: /^[0-9+\- ]{7,15}$/,
          message: localize('com_farmer_validation_phone_invalid'),
        },
      };
    }

    if (field === 'languagePreference') {
      return {
        required: localize('com_farmer_validation_language_required'),
      };
    }

    return { required: localize('com_farmer_validation_required_generic', { 0: label }) };
  };

  const isFormValid = () => {
    return missingFields.every((field) => {
      if (field === 'location') {
        return !!watch('location.latitude') && !!watch('location.longitude');
      }
      if (field === 'district' && watch('district') === 'Other') {
        return !!watch('customDistrict');
      }
      return !!watch(field as any);
    });
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent
        showCloseButton={true}
        className="flex max-h-[90vh] w-11/12 max-w-md flex-col overflow-y-auto sm:w-full"
      >
        <OGDialogHeader>
          <OGDialogTitle className="text-lg font-bold text-text-primary">
            {localize('com_farmer_complete_profile_title')}
          </OGDialogTitle>
        </OGDialogHeader>

        <form onSubmit={handleSubmit(onSubmit, onFormError)} className="mt-4 flex flex-col">
          <p className="mb-4 text-sm text-text-secondary">
            {localize('com_farmer_complete_profile_helper')}
          </p>

          {orderedMissingFields.map((field) => {
            const config = fieldConfig[field];
            if (!config) return null;

            if (config.type === 'language-select') {
              return (
                <div key={field} className={fieldClass}>
                  <Controller
                    name="languagePreference"
                    control={control}
                    rules={{ required: localize('com_farmer_validation_language_required') }}
                    render={({ field: controllerField }) => (
                      <LangSelector
                        langcode={controllerField.value ?? langcode}
                        onChange={(value) => {
                          handleLanguageChange(value);
                          controllerField.onChange(resolveLanguageCode(value));
                        }}
                        portal={false}
                      />
                    )}
                  />
                  {errors.languagePreference && (
                    <p className="mt-1 text-xs text-red-500">{errors.languagePreference.message}</p>
                  )}
                </div>
              );
            }

            if (config.type === 'searchable-select') {
              return (
                <div key={field} className={fieldClass}>
                  <Label>{config.label}</Label>
                  <Controller
                    name={field as any}
                    control={control}
                    rules={getValidationRules(field, config.label)}
                    render={({ field: controllerField }) => {
                      let onSelectChange = controllerField.onChange;
                      if (field === 'state') {
                        onSelectChange = handleStateChange;
                      } else if (field === 'district') {
                        onSelectChange = handleDistrictChange;
                      }

                      return (
                        <SearchableSelect
                          options={field === 'district' ? districtOptions : config.options || []}
                          value={controllerField.value ?? ''}
                          onChange={onSelectChange}
                          placeholder={`${localize('com_ui_select')} ${config.label}`}
                          disabled={field === 'district' && !selectedState}
                        />
                      );
                    }}
                  />
                  {errors[field as keyof FarmerLocationForm] && (
                    <p className="mt-1 text-xs text-red-500">
                      {(errors[field as keyof FarmerLocationForm] as any)?.message}
                    </p>
                  )}

                  {field === 'district' && selectedDistrict === 'Other' && (
                    <div className="mt-4">
                      <Label htmlFor="customDistrict">
                        {localize('com_farmer_label_custom_district')}
                      </Label>
                      <Input
                        id="customDistrict"
                        placeholder={localize('com_farmer_placeholder_custom_district')}
                        className={inputClass}
                        {...register('customDistrict', {
                          required: localize('com_farmer_validation_custom_district_required'),
                        })}
                      />
                      {errors.customDistrict && (
                        <p className="mt-1 text-xs text-red-500">{errors.customDistrict.message}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            if (config.type === 'radio') {
              return (
                <div key={field} className={fieldClass}>
                  <Label>{config.label}</Label>
                  <div className="mt-2 flex gap-6">
                    {['yes', 'no'].map((val) => (
                      <label
                        key={val}
                        className="flex cursor-pointer items-center gap-2 text-sm text-text-primary"
                      >
                        <input
                          type="radio"
                          value={val}
                          className="accent-green-600"
                          {...register(field as any, {
                            required: localize('com_farmer_validation_field_required'),
                          })}
                        />
                        {val === 'yes' ? localize('com_ui_yes') : localize('com_ui_no')}
                      </label>
                    ))}
                  </div>
                  {errors[field as keyof FarmerLocationForm] && (
                    <p className="mt-1 text-xs text-red-500">
                      {(errors[field as keyof FarmerLocationForm] as any)?.message}
                    </p>
                  )}
                </div>
              );
            }

            return (
              <div key={field} className={fieldClass}>
                <Label htmlFor={field}>{config.label}</Label>
                <Input
                  id={field}
                  type={config.type}
                  placeholder={config.placeholder}
                  className={inputClass}
                  {...register(field as any, getValidationRules(field, config.label))}
                />
                {errors[field as keyof FarmerLocationForm] && (
                  <p className="mt-1 text-xs text-red-500">
                    {(errors[field as keyof FarmerLocationForm] as any)?.message}
                  </p>
                )}
              </div>
            );
          })}

          {isLocationMissing && (
            <>
              <input type="hidden" {...register('location.latitude')} />
              <input type="hidden" {...register('location.longitude')} />
              <div className="mb-4 rounded-md border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-900/10">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400 dark:text-blue-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                      {localize('com_farmer_label_important')}
                    </h3>
                    <div className="mt-2 text-sm text-blue-700 dark:text-blue-400">
                      <p>{localize('com_farmer_helper_location_capture')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className={fieldClass}>
                <Label>{localize('com_farmer_label_current_location')}</Label>
                <div className="mt-2 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={getLocation}
                    disabled={isLocating}
                    className="inline-flex w-fit items-center justify-center rounded-lg border border-border-heavy bg-surface-secondary px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-active disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLocating
                      ? localize('com_farmer_button_locating')
                      : localize('com_farmer_button_get_location')}
                  </button>
                  {watch('location.latitude') && watch('location.longitude') && (
                    <span className="text-sm font-medium text-green-600 dark:text-green-500">
                      {localize('com_farmer_location_captured_success')}
                    </span>
                  )}
                  {locationError && <span className="text-sm text-red-500">{locationError}</span>}
                </div>
              </div>
            </>
          )}

          {Object.keys(errors).length > 0 && (
            <div className="mt-2 text-sm text-red-500">
              {localize('com_farmer_validation_fix_errors')}
            </div>
          )}
          {submitError && <div className="mt-2 text-sm text-red-500">{submitError}</div>}

          <div className="mt-4 flex justify-end gap-2 border-t border-border-heavy pt-4">
            <button
              type="submit"
              disabled={saveMutation.isLoading || !isFormValid()}
              className="hover:bg-surface-active-hover inline-flex items-center justify-center rounded-lg bg-surface-active px-6 py-2 text-sm font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isLoading ? localize('com_ui_saving') : localize('com_ui_save')}
            </button>
          </div>
        </form>
      </OGDialogContent>
    </OGDialog>
  );
};

export default FarmerLocationModal;
