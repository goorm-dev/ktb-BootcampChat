import { forwardRef } from 'react';

/* -------------------------------------------------------------------------------------------------
 * Table.Root
 * -----------------------------------------------------------------------------------------------*/

const Root = forwardRef(
    ({ className, style, ...props }, ref) => {
        return (
            <table
                ref={ref}
                className={className}
                style={{
                    borderCollapse: 'collapse',
                    ...style,
                }}
                {...props}
            />
        );
    },
);
Root.displayName = 'TableRoot';

/* -------------------------------------------------------------------------------------------------
 * Table.Header
 * -----------------------------------------------------------------------------------------------*/

const Header = forwardRef((props, ref) => {
    return <thead ref={ref} {...props} />;
});
Header.displayName = 'TableHeader';

/* -------------------------------------------------------------------------------------------------
 * Table.Body
 * -----------------------------------------------------------------------------------------------*/

const Body = forwardRef((props, ref) => {
    return <tbody ref={ref} {...props} />;
});
Body.displayName = 'TableBody';

/* -------------------------------------------------------------------------------------------------
 * Table.Footer
 * -----------------------------------------------------------------------------------------------*/

const Footer = forwardRef((props, ref) => {
    return <tfoot ref={ref} {...props} />;
});
Footer.displayName = 'TableFooter';

/* -------------------------------------------------------------------------------------------------
 * Table.Row
 * -----------------------------------------------------------------------------------------------*/

const Row = forwardRef(
    ({ className, style, ...props }, ref) => {
        return (
            <tr
                ref={ref}
                className={className}
                style={{
                    borderBottom: '1px solid',
                    borderBottomColor: 'var(--vapor-color-border-normal)',
                    ...style,
                }}
                {...props}
            />
        );
    },
);
Row.displayName = 'TableRow';

/* -------------------------------------------------------------------------------------------------
 * Table.Heading
 * -----------------------------------------------------------------------------------------------*/

const Heading = forwardRef(
    ({ className, style, ...props }, ref) => {
        return (
            <th
                ref={ref}
                className={className}
                style={{
                    paddingBlock: 'var(--vapor-space-100)',
                    paddingInline: 'var(--vapor-space-300)',
                    textAlign: 'start',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    color: 'var(--vapor-color-foreground-normal-100)',
                    ...style,
                }}
                {...props}
            />
        );
    },
);
Heading.displayName = 'TableHeading';

/* -------------------------------------------------------------------------------------------------
 * Table.Cell
 * -----------------------------------------------------------------------------------------------*/

const Cell = forwardRef(
    ({ className, style, ...props }, ref) => {
        return (
            <td
                ref={ref}
                className={className}
                style={{
                    paddingBlock: 'var(--vapor-space-100)',
                    paddingInline: 'var(--vapor-space-300)',
                    textAlign: 'start',
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    color: 'var(--vapor-color-foreground-normal-200)',
                    ...style,
                }}
                {...props}
            />
        );
    },
);
Cell.displayName = 'TableCell';

/* -------------------------------------------------------------------------------------------------
 * Table.ColumnGroup
 * -----------------------------------------------------------------------------------------------*/

const ColumnGroup = forwardRef((props, ref) => {
    return <colgroup ref={ref} {...props} />;
});
ColumnGroup.displayName = 'TableColumnGroup';

/* -------------------------------------------------------------------------------------------------
 * Table.Column
 * -----------------------------------------------------------------------------------------------*/

const Column = forwardRef((props, ref) => {
    return <col ref={ref} {...props} />;
});
Column.displayName = 'TableColumn';

export { Root, Header, Body, Footer, Row, Heading, Cell, ColumnGroup, Column };
