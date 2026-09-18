alter table public.mission365_applications
  drop constraint if exists mission365_applications_status_check;

alter table public.mission365_applications
  add constraint mission365_applications_status_check
  check (
    status = any(array[
      'draft'::text,
      'submitted'::text,
      'under_review'::text,
      'documents_required'::text,
      'waitlisted'::text,
      'reviewing'::text,
      'needs_information'::text,
      'conditionally_approved'::text,
      'approved'::text,
      'rejected'::text,
      'withdrawn'::text
    ])
  );

comment on constraint mission365_applications_status_check on public.mission365_applications is
'Mission 365 application lifecycle. Legacy submitted/under_review remain valid for backward compatibility; current applicant flow uses documents_required -> waitlisted -> reviewing/needs_information -> conditionally_approved/approved/rejected.';
