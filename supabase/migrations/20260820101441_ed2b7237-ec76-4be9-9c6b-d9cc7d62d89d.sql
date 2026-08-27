CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, phone, business_name,
    business_type, legal_form, sector, region, size_category,
    employee_count, annual_turnover, does_import, does_export, tax_registrations, activities
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    NEW.raw_user_meta_data->>'business_name',
    NEW.raw_user_meta_data->>'business_type',
    NEW.raw_user_meta_data->>'legal_form',
    NEW.raw_user_meta_data->>'sector',
    NEW.raw_user_meta_data->>'region',
    COALESCE(NEW.raw_user_meta_data->>'size_category', 'Not set'),
    NULLIF(NEW.raw_user_meta_data->>'employee_count','')::integer,
    NULLIF(NEW.raw_user_meta_data->>'annual_turnover','')::numeric,
    COALESCE((NEW.raw_user_meta_data->>'does_import')::boolean, false),
    COALESCE((NEW.raw_user_meta_data->>'does_export')::boolean, false),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(NEW.raw_user_meta_data->'tax_registrations','[]'::jsonb))),
      '{}'
    ),
    '{}'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $function$