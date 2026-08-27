import type { Metadata } from 'next';
import './globals.css';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: '断电以后｜原创纯文字生存游戏',
  description: '选择难度，用七天准备封锁；按时钟安排行动，使用公寓家具并活到撤离。',
  openGraph: {
    title: '断电以后｜原创纯文字生存游戏',
    description: '七天准备。停电以后，每一件留下的东西都有重量。',
    images: [{ url: `${siteUrl}/og.png`, width: 1600, height: 900, alt: '断电以后游戏标题' }],
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '断电以后｜原创纯文字生存游戏',
    description: '七天准备。停电以后，每一件留下的东西都有重量。',
    images: [`${siteUrl}/og.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
