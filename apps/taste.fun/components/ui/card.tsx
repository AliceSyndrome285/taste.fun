import { HTMLAttributes } from 'react';
import clsx from 'clsx';

function Root({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('card', className)} {...props} />;
}

function Header({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('card-header', className)} {...props} />;
}

function Content({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('card-content', className)} {...props} />;
}

export const Card = Object.assign(Root, { Header, Content });
