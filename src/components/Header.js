import React from 'react';

import testPdf from '../files/demo_tags.pdf';
import mediumPdf from '../files/test_2.pdf';
import bigPdf from '../files/test.pdf';
import hugePdf from '../files/huge.pdf';

let disabledSize = 'small';

function Header(props) {
    let uploadInputRef;
    function setUploadInputRef(node) {
        uploadInputRef = node;
    }

    function onUploadPdfClick() {
        uploadInputRef.click();
    }

    function uploadTestPdf(size) {
        let file;
        switch (size) {
            case 'small':
                file = testPdf;
                break;
            case 'medium':
                file = mediumPdf;
                break;
            case 'big':
                file = bigPdf;
                break;
            case 'huge':
                file = hugePdf;
                break;
        }

        return (e) => {
            disabledSize = size;
            props.onUploadSctrictFile(file);
        };
    }

    return (
        <header className="App-header">
            <section className=""app-btn-pane>
                <button onClick={uploadTestPdf('small')} className="app-btn" disabled={disabledSize === 'small' || props.loading}>
                    Small pdf
                </button>
                <button onClick={uploadTestPdf('medium')} className="app-btn" disabled={disabledSize === 'medium' || props.loading}>
                    Medium pdf
                </button>
                <button onClick={uploadTestPdf('big')} className="app-btn" disabled={disabledSize === 'big' || props.loading}>
                    Big pdf
                </button>
                <button onClick={uploadTestPdf('huge')} className="app-btn" disabled={disabledSize === 'huge' || props.loading}>
                    Huge pdf
                </button>
                <button onClick={onUploadPdfClick} className="app-btn" disabled={props.loading}>
                    Upload other pdf
                </button>
                <input type='file' onChange={props.onUploadFile} ref={setUploadInputRef} style={{'display': 'none'}}/>
            </section>
            <div className="pdf-loading">
                {props.loading ? 'Loading pdf...' : ''}
            </div>
        </header>
    );
}

export default Header;
