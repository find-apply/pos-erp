import { PropsWithChildren, ReactNode, Fragment } from "react";
import {AppSidebar} from "@/components/app-sidebar";
import {SidebarInset, SidebarProvider, SidebarTrigger} from "@/components/ui/sidebar";
import {Separator} from "@/components/ui/separator";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbLink,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NavUser } from "@/components/nav-user";
import { usePage, Head, Link, router } from "@inertiajs/react";
import { PageProps } from "@/types";
import { BrandProvider, useBrand } from "@/contexts/brand-context";
import CookieConsent from "@/components/cookie-consent";
import { useFavicon } from "@/hooks/use-favicon";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { UserX, ArrowLeft } from "lucide-react";
import { useFlashMessages } from "@/hooks/useFlashMessages";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";

function AuthenticatedLayoutContent({
    header,
    children,
    breadcrumbs,
    pageTitle,
    pageActions,
    backUrl,
    className,
    ...props
}: PropsWithChildren<{
    header?: ReactNode;
    breadcrumbs?: Array<{label: string, url?: string}>;
    pageTitle?: string;
    pageActions?: ReactNode;
    backUrl?: string;
    className?: string;
}>) {
    const { t } = useTranslation();
    const { auth, companyAllSetting, adminAllSetting } = usePage<PageProps>().props as any;
    const { settings } = useBrand();
    useFavicon();
    useFlashMessages();

    return (
        <>
        <Head>
            {companyAllSetting?.metaKeywords && (
                <meta name="keywords" content={companyAllSetting.metaKeywords} />
            )}
            {companyAllSetting?.metaDescription && (
                <meta name="description" content={companyAllSetting.metaDescription} />
            )}
            {companyAllSetting?.metaImage && (
                <meta property="og:image" content={companyAllSetting.metaImage} />
            )}
        </Head>
        <div
            className={settings.layoutDirection === 'rtl' ? 'rtl' : 'ltr'}
            data-theme={settings.themeMode}
            dir={settings.layoutDirection === 'rtl' ? 'rtl' : 'ltr'}
            style={{ direction: settings.layoutDirection === 'rtl' ? 'rtl' : 'ltr' }}
        >
        <SidebarProvider defaultOpen={true}>
            <AppSidebar />

            <SidebarInset className="overflow-visible"
                style={{ direction: settings.layoutDirection === 'rtl' ? 'rtl' : 'ltr' }}
                dir={settings.layoutDirection === 'rtl' ? 'rtl' : 'ltr'}
            >
                {/*
                  * The shell already sets `dir`, so flexbox lays this row out
                  * in the right order on its own. The previous `order-*` /
                  * `flex-row-reverse` branching fought that and had to be kept
                  * in sync by hand for every new control.
                  */}
                <header className="sticky top-0 z-30 mb-2 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    {/* Sidebar toggle + breadcrumb */}
                    <div className="flex min-w-0 items-center gap-2">
                        <SidebarTrigger className="h-8 w-8 shrink-0" />
                        <Separator orientation="vertical" className="h-4 shrink-0" />

                        <Breadcrumb className="min-w-0">
                            <BreadcrumbList className="flex-nowrap">
                                <BreadcrumbItem className="hidden shrink-0 sm:inline-flex">
                                    <BreadcrumbLink asChild>
                                        <Link href={route("dashboard")}>{t('Dashboard')}</Link>
                                    </BreadcrumbLink>
                                </BreadcrumbItem>

                                {breadcrumbs?.map((crumb, index) => {
                                    // On narrow screens only the current page is
                                    // kept, so a deep path cannot squeeze out the
                                    // header controls.
                                    const isLast = index === breadcrumbs.length - 1;

                                    return (
                                        <Fragment key={index}>
                                            <BreadcrumbSeparator className="hidden shrink-0 rtl:rotate-180 sm:block" />
                                            <BreadcrumbItem className={isLast ? 'min-w-0' : 'hidden shrink-0 sm:inline-flex'}>
                                                {crumb.url ? (
                                                    <BreadcrumbLink asChild>
                                                        <Link href={crumb.url} className="truncate">{crumb.label}</Link>
                                                    </BreadcrumbLink>
                                                ) : (
                                                    <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                                                )}
                                            </BreadcrumbItem>
                                        </Fragment>
                                    );
                                })}
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>

                    {/* Global search - opens with Cmd/Ctrl-K */}
                    <div className="hidden min-w-0 flex-1 justify-center md:flex">
                        <CommandPalette />
                    </div>

                    {/* Actions. `ms-auto` pins them to the inline end once the
                        centre search is hidden on small screens. */}
                    <div className="ms-auto flex shrink-0 items-center gap-1 md:ms-0">
                        {auth.impersonating && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.post(route('users.leave-impersonation'))}
                                className="h-8 border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                            >
                                <UserX className="me-2 h-4 w-4" />
                                <span className="hidden sm:inline">{t('Leave Login As User')}</span>
                            </Button>
                        )}

                        <div className="md:hidden">
                            <CommandPalette variant="icon" />
                        </div>

                        <ThemeToggle />
                        <NavUser user={auth.user} inHeader={true} />
                    </div>
                </header>

                <main className="p-4 md:pt-0 h-full">
                    {pageTitle && (
                        <div className="flex items-center mb-4 gap-3" dir={settings.layoutDirection}>
                            <h1 className="text-xl font-semibold flex-1">{pageTitle}</h1>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {backUrl && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex items-center gap-2 h-8 px-3"
                                        onClick={() => router.visit(backUrl)}
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        {t('Back')}
                                    </Button>
                                )}
                                {pageActions}
                            </div>
                        </div>
                    )}
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
        <CookieConsent settings={adminAllSetting || {}} />
        </div>
        </>
    );
}

export default function AuthenticatedLayout({
    children,
    header,
    breadcrumbs,
    pageTitle,
    pageActions,
    backUrl,
    className,
    ...props
}: PropsWithChildren<{
    header?: ReactNode;
    breadcrumbs?: Array<{label: string, url?: string}>;
    pageTitle?: string;
    pageActions?: ReactNode;
    backUrl?: string;
    className?: string;
}>) {
    return (
        <BrandProvider>
            <AuthenticatedLayoutContent
                header={header}
                breadcrumbs={breadcrumbs}
                pageTitle={pageTitle}
                pageActions={pageActions}
                backUrl={backUrl}
                className={className}
                {...props}
            >
                {children}
            </AuthenticatedLayoutContent>
        </BrandProvider>
    );
}
