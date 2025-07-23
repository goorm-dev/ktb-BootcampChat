/**
 * Mapping of lucide-react icons to @vapor-ui/icons equivalents
 * 
 * This mapping helps in migrating from lucide-react to Vapor UI icons
 * throughout the codebase.
 */

export const lucideToVaporIconMapping = {
  // Alert & Info Icons
  'AlertCircle': 'ErrorCircleIcon',         // Error/alert states
  'AlertTriangle': 'WarningIcon',           // Warning states
  'Info': 'InfoCircleIcon',                 // Information states
  'HelpCircle': 'HelpCircleIcon',           // Help/question states
  
  // Check & Status Icons
  'Check': 'CheckIcon',                     // Single check mark
  'CheckCheck': 'CheckIcon',                // Double check (use single check)
  'CheckCircle': 'CheckCircleIcon',         // Check in circle
  'CheckCircle2': 'CheckCircleIcon',        // Alternative check circle
  
  // Action Icons
  'Send': 'SendIcon',                       // Send message/submit
  'Copy': 'CopyIcon',                       // Copy to clipboard
  'Download': 'DownloadIcon',               // Download action
  'Upload': 'UploadIcon',                   // Upload action
  'Refresh': 'RefreshOutlineIcon',          // Refresh/reload
  'RefreshCcw': 'RefreshOutlineIcon',       // Refresh counter-clockwise
  
  // Media Icons
  'Camera': 'CameraIcon',                   // Camera/photo capture
  'Image': 'ImageIcon',                     // Image/picture
  'Video': 'MovieIcon',                     // Video file
  'Film': 'MovieIcon',                      // Film/movie (alternative)
  'Music': 'SoundOnIcon',                   // Music/audio file
  
  // File Icons
  'File': 'FileIcon',                       // Generic file
  'FileText': 'PdfIcon',                    // Text/document file
  'FileCode2': 'CodeBlockIcon',             // Code file
  'Paperclip': 'AttachFileOutlineIcon',     // File attachment
  
  // UI Control Icons
  'X': 'CloseOutlineIcon',                  // Close/dismiss
  'XCircle': 'ErrorCircleIcon',             // Close in circle
  'ChevronDown': 'CaretDownIcon',           // Dropdown arrow
  'ChevronUp': 'CaretUpIcon',               // Upward arrow
  'ChevronLeft': 'CaretLeftIcon',           // Left arrow
  'ChevronRight': 'CaretRightIcon',         // Right arrow
  
  // Status & State Icons
  'Timer': 'TimeIcon',                      // Timer/clock
  'Clock': 'TimeIcon',                      // Clock/time
  'Lock': 'LockIcon',                       // Locked state
  'LockKeyhole': 'LockIcon',                // Lock with keyhole
  'Unlock': 'UnlockIcon',                   // Unlocked state
  'WifiOff': 'NetworkIcon',                 // No connection (use network icon)
  
  // Communication Icons
  'Mail': 'MailIcon',                       // Email/mail
  'MessageCircle': 'MessageIcon',           // Chat message
  'Users': 'GroupIcon',                     // Multiple users/group
  'User': 'UserIcon',                       // Single user
  
  // External & Link Icons
  'ExternalLink': 'LinkOutlineIcon',        // External link
  'Link2': 'LinkOutlineIcon',               // Alternative link icon
  
  // Emoji & Expression Icons
  'Smile': 'AiGoormeeIcon',                 // Smile/emoji (use AI mascot as alternative)
  'SmilePlus': 'AiGoormeeIcon',             // Add emoji (use AI mascot as alternative)
  'PartyPopper': 'StarIcon',                // Celebration (use star as alternative)
  
  // Text Formatting Icons
  'Bold': 'TextOutlineIcon',                // Bold text (use generic text)
  'Italic': 'TextOutlineIcon',              // Italic text (use generic text)
  'Code': 'CodeBlockIcon',                  // Inline code
  'Quote': 'QuoteIcon',                     // Quote/blockquote
  'List': 'AssignmentIcon',                 // Unordered list
  'ListOrdered': 'AssignmentIcon',          // Ordered list
  'Heading2': 'TextOutlineIcon',            // Heading (use generic text)
  
  // Misc Icons
  'Loader': 'HourglassIcon',                // Loading state
  'Trash': 'TrashIcon',                     // Delete/trash
  'Edit': 'EditIcon',                       // Edit action
  'Plus': 'PlusOutlineIcon',                // Add/plus
  'Minus': 'MinusBoxIcon',                  // Remove/minus
};

/**
 * Get the Vapor UI icon equivalent for a lucide-react icon
 * @param {string} lucideIconName - The name of the lucide-react icon
 * @returns {string} The equivalent Vapor UI icon name
 */
export function getVaporIcon(lucideIconName) {
  return lucideToVaporIconMapping[lucideIconName] || lucideIconName;
}

/**
 * Import statement mappings for common icon imports
 * Use these to replace lucide-react imports with @vapor-ui/icons imports
 */
export const importMappings = {
  // Alert & Status Icons
  "import { AlertCircle } from 'lucide-react'": "import { ErrorCircleIcon } from '@vapor-ui/icons'",
  "import { AlertTriangle } from 'lucide-react'": "import { WarningIcon } from '@vapor-ui/icons'",
  "import { Info } from 'lucide-react'": "import { InfoCircleIcon } from '@vapor-ui/icons'",
  "import { CheckCircle2 } from 'lucide-react'": "import { CheckCircleIcon } from '@vapor-ui/icons'",
  
  // Check Icons
  "import { Check } from 'lucide-react'": "import { CheckIcon } from '@vapor-ui/icons'",
  "import { CheckCheck } from 'lucide-react'": "import { CheckIcon } from '@vapor-ui/icons'",
  
  // Action Icons
  "import { Send } from 'lucide-react'": "import { SendIcon } from '@vapor-ui/icons'",
  "import { Copy } from 'lucide-react'": "import { CopyIcon } from '@vapor-ui/icons'",
  "import { RefreshCcw } from 'lucide-react'": "import { RefreshOutlineIcon } from '@vapor-ui/icons'",
  
  // Media Icons
  "import { Camera } from 'lucide-react'": "import { CameraIcon } from '@vapor-ui/icons'",
  "import { Image } from 'lucide-react'": "import { ImageIcon } from '@vapor-ui/icons'",
  "import { Video, Film } from 'lucide-react'": "import { MovieIcon } from '@vapor-ui/icons'",
  "import { Music } from 'lucide-react'": "import { SoundOnIcon } from '@vapor-ui/icons'",
  
  // File Icons
  "import { File } from 'lucide-react'": "import { FileIcon } from '@vapor-ui/icons'",
  "import { FileText } from 'lucide-react'": "import { PdfIcon } from '@vapor-ui/icons'",
  "import { Paperclip } from 'lucide-react'": "import { AttachFileOutlineIcon } from '@vapor-ui/icons'",
  
  // UI Control Icons
  "import { X } from 'lucide-react'": "import { CloseOutlineIcon } from '@vapor-ui/icons'",
  "import { ChevronDown } from 'lucide-react'": "import { CaretDownIcon } from '@vapor-ui/icons'",
  
  // Status Icons
  "import { Timer, Clock } from 'lucide-react'": "import { TimeIcon } from '@vapor-ui/icons'",
  "import { Lock, LockKeyhole } from 'lucide-react'": "import { LockIcon } from '@vapor-ui/icons'",
  "import { WifiOff } from 'lucide-react'": "import { NetworkIcon } from '@vapor-ui/icons'",
  
  // Communication Icons
  "import { Mail } from 'lucide-react'": "import { MailIcon } from '@vapor-ui/icons'",
  "import { Users } from 'lucide-react'": "import { GroupIcon } from '@vapor-ui/icons'",
  
  // External Link Icons
  "import { ExternalLink } from 'lucide-react'": "import { LinkOutlineIcon } from '@vapor-ui/icons'",
  
  // Emoji Icons (using alternatives)
  "import { Smile, SmilePlus } from 'lucide-react'": "import { AiGoormeeIcon } from '@vapor-ui/icons'",
  "import { PartyPopper } from 'lucide-react'": "import { StarIcon } from '@vapor-ui/icons'",
};

/**
 * Notes on icon replacements:
 * 
 * 1. Some lucide-react icons don't have exact equivalents in Vapor UI:
 *    - Smile/SmilePlus: Using AiGoormeeIcon as a friendly alternative
 *    - PartyPopper: Using StarIcon for celebration/success states
 *    - WifiOff: Using NetworkIcon (may need to add visual indicator for "off" state)
 *    - CheckCheck (double check): Using single CheckIcon
 *    - Text formatting icons (Bold, Italic, etc.): Using generic TextOutlineIcon
 * 
 * 2. Some Vapor UI icons have slightly different names:
 *    - AlertCircle → ErrorCircleIcon
 *    - AlertTriangle → WarningIcon
 *    - RefreshCcw → RefreshOutlineIcon
 *    - Film/Video → MovieIcon
 *    - FileText → PdfIcon (for document files)
 * 
 * 3. Consider adding custom styling or wrapping components for icons that need
 *    specific visual states (e.g., WifiOff could be NetworkIcon with a strikethrough)
 */