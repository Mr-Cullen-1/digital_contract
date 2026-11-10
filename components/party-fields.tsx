"use client";
import { type Party, type Role, roleLabels } from "@/lib/domain";
import { Field, Input } from "./ui/primitives";
export function PartyFields({
  value,
  onChange,
  compact = false,
  roleEditable = false,
}: {
  value: Party;
  onChange: (p: Party) => void;
  compact?: boolean;
  roleEditable?: boolean;
}) {
  const update = (key: keyof Party, v: string) =>
    onChange({ ...value, [key]: v });
  return (
    <div className={compact ? "form-stack" : "form-grid"}>
      <Field label="ФИО / название компании">
        <Input
          value={value.name}
          onChange={(e) => update("name", e.target.value)}
          maxLength={200}
          placeholder="Иван Иванов или ООО «Компания»"
          autoComplete="name"
        />
      </Field>
      <Field label="Адрес">
        <Input
          value={value.address}
          onChange={(e) => update("address", e.target.value)}
          maxLength={500}
          placeholder="Город, улица, дом"
          autoComplete="street-address"
        />
      </Field>
      <Field label="Номер телефона">
        <Input
          value={value.phone}
          onChange={(e) => update("phone", e.target.value)}
          maxLength={30}
          type="tel"
          placeholder="+998 90 123 45 67"
          autoComplete="tel"
        />
      </Field>
      <Field label="ПИНФЛ" hint="14 цифр. Достаточно ПИНФЛ или паспорта.">
        <Input
          value={value.pinfl}
          onChange={(e) => update("pinfl", e.target.value.replace(/\D/g, ""))}
          maxLength={14}
          inputMode="numeric"
          placeholder="00000000000000"
          autoComplete="off"
        />
      </Field>
      <Field label="Серия и номер паспорта">
        <Input
          value={value.passport}
          onChange={(e) => update("passport", e.target.value)}
          maxLength={30}
          placeholder="AA1234567"
          autoComplete="off"
        />
      </Field>
      {roleEditable && (
        <Field label="Ваша роль">
          <select
            className="input"
            value={value.role}
            onChange={(e) => update("role", e.target.value as Role)}
          >
            {Object.entries(roleLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}
