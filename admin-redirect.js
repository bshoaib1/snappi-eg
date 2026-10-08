/* Legacy admin URL: preserve a Supabase recovery fragment while moving to the workspace. */
window.location.replace(`workspace/${window.location.hash}`);
