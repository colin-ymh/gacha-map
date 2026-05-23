"use client";

import { useTranslations } from "next-intl";
import { TEXT_PLACEHOLDER } from "@/styles/color";
import LegalPage from "./legal-page";

const TermsPanel = () => {
  const t = useTranslations("terms");

  return (
    <LegalPage title={t("title")} backLabel={t("back")}>
      <h2>{t("s1Title")}</h2>
      <p>{t("s1p1")}</p>

      <h2>{t("s2Title")}</h2>
      <p>{t("s2p1")}</p>
      <p>{t("s2p2")}</p>

      <h2>{t("s3Title")}</h2>
      <p>{t("s3p1")}</p>
      <p>{t("s3p2")}</p>

      <h2>{t("s4Title")}</h2>
      <p>{t("s4p1")}</p>
      <p>{t("s4p2")}</p>

      <h2>{t("s5Title")}</h2>
      <p>{t("s5p1")}</p>
      <p>{t("s5p2")}</p>

      <h2>{t("s6Title")}</h2>
      <p>{t("s6p1")}</p>

      <h2>{t("s7Title")}</h2>
      <p>{t("s7p1")}</p>
      <p>{t("s7p2")}</p>

      <h2>{t("s8Title")}</h2>
      <p>{t("s8p1")}</p>

      <p style={{ marginTop: 32, color: TEXT_PLACEHOLDER }}>
        {t("effectiveDate")}
      </p>
    </LegalPage>
  );
};

export default TermsPanel;
