"use client"

import * as React from "react"
import {
  Command,
  Frame, Home,
  LifeBuoy,
  Send,
  SquareTerminal,
  Search,
  Building2,
} from "lucide-react"

import { NavSections } from "@/components/nav-sections"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarInput,
} from "@/components/ui/sidebar"
import {Link, usePage} from "@inertiajs/react";
import {PageProps} from "@/types";
import { allMenuItems } from "@/utils/menu";
import { useTranslation } from 'react-i18next';
import { useBrand } from "@/contexts/brand-context";



export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { auth } = usePage<PageProps>().props;
    const { t } = useTranslation();
    const { settings, getCompleteSidebarProps, getPreviewUrl } = useBrand();
    const [searchQuery, setSearchQuery] = React.useState("");

    const sidebarProps = getCompleteSidebarProps();

    const brandName = settings.titleText || 'DzERP';
    const companyName = (auth as any)?.user?.name || brandName;
    // Superadmins see every module; companies see what their plan activated.
    const planLabel = (auth as any)?.user?.roles?.includes('superadmin')
        ? 'ADMIN'
        : ((auth as any)?.user?.activatedPackages?.length ? 'FULL' : 'BASE');
    const faviconUrl = settings.favicon ? getPreviewUrl(settings.favicon) : '';

    return (
    <Sidebar
        variant={settings.sidebarVariant as any}
        side={settings.layoutDirection === 'rtl' ? 'right' : 'left'}
        collapsible="icon"
        className={sidebarProps.className}
        style={sidebarProps.style}
        {...props}
    >
      <SidebarHeader className="gap-3 border-b border-gray-100 pb-3 dark:border-slate-800">
        {/* Brand: gradient tile + wordmark + plan badge */}
        <Link href={route('dashboard')} className="flex items-center gap-2.5 px-2 pt-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-orange-500 text-white shadow-sm">
            {faviconUrl
              ? <img src={faviconUrl} alt="" className="h-full w-full object-cover" />
              : <Building2 className="h-5 w-5" />}
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-base font-bold leading-tight tracking-wide text-gray-900 dark:text-white">
              {brandName.toUpperCase()}
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-blue-500">
              {planLabel}
            </span>
          </span>
        </Link>

        {/* Company card */}
        <div className="mx-2 rounded-lg bg-gray-50 px-3 py-2 group-data-[collapsible=icon]:hidden dark:bg-slate-800">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{companyName}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {planLabel}
          </p>
        </div>

        <div className="px-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 dark:border-slate-700 dark:bg-slate-800">
            <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <input
              placeholder={t('Search menu...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
            />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavSections items={allMenuItems()} searchQuery={searchQuery} />
      </SidebarContent>
    </Sidebar>
  )
}
