import React from 'react';
import { Page } from "react-pdf";

function PdfPage({ pageIndex, onPageRenderSuccess }) {
    return (
        <Page className="pdf-page"
              pageNumber={pageIndex}
              renderAnnotationLayer={true}
              renderInteractiveForms={true}
              renderTextLayer={true}
              onRenderSuccess={onPageRenderSuccess}
              customTextRenderer={({height,  width, transform, scale, page, str}) => {
                  /*
                  height: height of text
                  width: width of text
                  transform: contain coordinates of text
                  scale: will be used for coords. conversing
                   */
                  return str;
              }}
        />
    );
}

export default PdfPage;
