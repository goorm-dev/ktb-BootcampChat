import React from 'react';
import { cn } from '../../utils/cn';

export const StyledTable = ({ children, className, ...props }) => {
  return (
    <div className={cn("styled-table-wrapper", className)}>
      <table className="styled-table" {...props}>
        {children}
      </table>
    </div>
  );
};

export const StyledTableHead = ({ children, className, ...props }) => {
  return (
    <thead className={cn("styled-table-head", className)} {...props}>
      {children}
    </thead>
  );
};

export const StyledTableBody = ({ children, className, ...props }) => {
  return (
    <tbody className={cn("styled-table-body", className)} {...props}>
      {children}
    </tbody>
  );
};

export const StyledTableRow = ({ children, className, onClick, ...props }) => {
  return (
    <tr 
      className={cn("styled-table-row", onClick && "clickable", className)} 
      onClick={onClick}
      {...props}
    >
      {children}
    </tr>
  );
};

export const StyledTableHeader = ({ children, className, width, ...props }) => {
  return (
    <th 
      className={cn("styled-table-header", className)} 
      style={{ width, ...props.style }}
      {...props}
    >
      {children}
    </th>
  );
};

export const StyledTableCell = ({ children, className, ...props }) => {
  return (
    <td className={cn("styled-table-cell", className)} {...props}>
      {children}
    </td>
  );
};