import { Dashboard } from "@/components/dashboard";
import { configured } from "@/lib/supabase/config";
export default function Home() {
  return <Dashboard configured={configured()} />;
}
