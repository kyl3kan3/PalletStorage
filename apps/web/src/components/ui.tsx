"use client";

import { type ButtonHTMLAttributes, type InputHTMLAttributes, type TableHTMLAttributes } from "react";

export const buttonClass =
  "inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";

export function Button({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={`${buttonClass} ${className}`} />;
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${className}`}
    />
  );
}

export function Table({ className = "", ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return <table {...rest} className={`w-full border-collapse text-sm ${className}`} />;
}

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-500">{children}</th>;
}

export function Td({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-slate-100 px-3 py-2">{children}</td>;
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div>{children}</div>
    </div>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{children}</div>;
}
