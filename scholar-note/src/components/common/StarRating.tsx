interface StarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
}

export function StarRating({ rating, onChange }: StarRatingProps) {
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);

  return (
    <span className="file-rating">
      {stars.map((star) => (
        <span
          key={star}
          style={{ cursor: onChange ? 'pointer' : 'default' }}
          onClick={onChange ? () => onChange(star) : undefined}
          role={onChange ? 'button' : undefined}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          {star <= rating ? '\u2605' : '\u2606'}
        </span>
      ))}
    </span>
  );
}
