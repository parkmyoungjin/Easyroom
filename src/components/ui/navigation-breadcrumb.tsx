'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface NavigationBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function NavigationBreadcrumb({ items, className = "" }: NavigationBreadcrumbProps) {
  const router = useRouter();

  const handleNavigate = (href: string) => {
    router.push(href);
  };

  return (
    <nav className={`flex items-center space-x-1 text-sm text-gray-500 ${className}`} aria-label="Breadcrumb">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleNavigate('/')}
        className="h-6 px-2 text-gray-500 hover:text-gray-700"
      >
        <Home className="h-3 w-3" />
      </Button>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          <ChevronRight className="h-3 w-3 mx-1" />
          {item.href && !item.current ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNavigate(item.href!)}
              className="h-6 px-2 text-gray-500 hover:text-gray-700"
            >
              {item.label}
            </Button>
          ) : (
            <span className={`px-2 ${item.current ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}