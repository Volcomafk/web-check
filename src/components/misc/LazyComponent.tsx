import React, { Suspense } from 'react';
import styled from 'styled-components';
import colors from 'styles/colors';

// Enhanced lazy loading wrapper with performance optimization
const LazyLoadWrapper = styled.div`
  min-height: 200px;
  position: relative;
`;

const LazyLoader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 150px;
  color: ${colors.textColorSecondary};
  font-size: 0.9rem;
  background: ${colors.backgroundDarker};
  border-radius: 8px;
  margin: 1rem 0;
  border: 1px solid ${colors.primary}33;
  
  &::before {
    content: '';
    width: 20px;
    height: 20px;
    border: 2px solid ${colors.primary}33;
    border-top-color: ${colors.primary};
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 10px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

interface LazyComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Optimized lazy loading component with smooth loading states
export const LazyComponent: React.FC<LazyComponentProps> = ({ 
  children, 
  fallback 
}) => {
  const defaultFallback = (
    <LazyLoadWrapper>
      <LazyLoader>
        Loading component...
      </LazyLoader>
    </LazyLoadWrapper>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
};

export default LazyComponent;