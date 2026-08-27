import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Business identity used on printed sales documents. */
export function useBusinessProfile() {
  const [profile, setProfile] = useState({ name: "Bizz", address: "", phone: "" });

  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      const { data } = await supabase
        .from("profiles")
        .select("business_name, full_name, phone")
        .eq("id", userId)
        .maybeSingle();
      const row = data as any;
      setProfile((prev) => ({
        ...prev,
        name: row?.business_name || row?.full_name || "Bizz",
        phone: row?.phone ?? "",
      }));
    })();
  }, []);

  return profile;
}
