import { ContractEditor } from "@/components/contract-editor";
import { configured } from "@/lib/supabase/config";
export default function UploadContract() {
  return <ContractEditor configured={configured()} upload />;
}
