ALTER TABLE public.owner_onboarding_profiles
  DROP CONSTRAINT IF EXISTS owner_onboarding_profiles_state_check;

ALTER TABLE public.owner_onboarding_profiles
  ADD CONSTRAINT owner_onboarding_profiles_state_check
  CHECK (state IS NULL OR char_length(state) <= 2);