/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: string | Date | null | undefined): number | null {
    if (!dateOfBirth) return null;
    
    const dob = new Date(dateOfBirth);
    const today = new Date();
    
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    return age;
  }
  
  /**
   * Format profile display string (e.g., "Adam, 32" or just "Adam")
   */
  export function formatProfileDisplay(name: string, dateOfBirth: string | Date | null | undefined): string {
    const age = calculateAge(dateOfBirth);
    if (age !== null) {
      return `${name}, ${age}`;
    }
    return name;
  }
  
  /**
   * Get avatar URL from Supabase storage
   * Returns null if no avatar_url is set
   */
  export function getAvatarUrl(avatarPath: string | null, supabaseUrl: string): string | null {
    if (!avatarPath) return null;
    
    // If it's already a full URL, return it
    if (avatarPath.startsWith('http')) {
      return avatarPath;
    }
    
    // Otherwise, construct the storage URL
    return `${supabaseUrl}/storage/v1/object/public/avatars/${avatarPath}`;
  }
  
  /**
   * Check if profile is complete (has photo and/or date of birth)
   * For v1, we consider a profile "complete enough" if they've been prompted
   * We track this by checking if either field has been set
   */
  export function isProfileComplete(profile: { avatar_url: string | null; date_of_birth: string | null } | null): boolean {
    if (!profile) return false;
    // Profile is considered "addressed" if user has either set a photo or DOB
    // or has explicitly skipped (we'll track this with a flag if needed)
    return !!(profile.avatar_url || profile.date_of_birth);
  }
  
  /**
   * Generate initials from name for avatar placeholder
   */
  export function getInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }